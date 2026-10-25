/**
 * F07g Stage 2A — CI-only PostgreSQL transactional quote proof.
 *
 * This creates/drops an isolated fixture table on disposable GitHub CI DB.
 * It intentionally does NOT install any Medusa schema migration or invoke
 * production Store API, payment provider, order workflow or refund logic.
 * No real quote/customer/token/PSP or persistent Production data is used.
 */
import assert from "node:assert/strict"
import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  issueCheckoutQuote,
  acceptCheckoutQuote,
  assertAcceptedCheckoutQuote,
  fingerprintQuoteSnapshot,
  type CheckoutQuote,
  type QuoteSnapshot,
} from "../lib/checkout/quote-contract"

const TABLE = "shqipshop_f07g_disposable_ci_quotes"
const conflict = /F07g checkout quote conflict/

export default async function verify({ container }: ExecArgs) {
  const required: Record<string, string> = {
    CI: "true",
    NODE_ENV: "development",
    SHQIPSHOP_REQUIRE_REDIS: "true",
    SHQIPSHOP_F07G_TRANSACTION_CI: "true",
    DATABASE_URL: "postgres://medusa_ci:disposable_ci_password@127.0.0.1:5432/medusa_ci",
    REDIS_URL: "redis://127.0.0.1:6379",
  }
  for (const [key, value] of Object.entries(required)) {
    assert.equal(process.env[key], value, key)
  }

  // Medusa's registered PostgreSQL connection is a Knex instance.
  // Deliberately resolve it from the running Medusa container, not a new
  // user-provided DB URL or a client-supplied tenant identity.
  const db: any = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  assert.equal(await db.schema.hasTable(TABLE), false,
    "CI table must be absent before proof; never alter any preexisting table")
  await db.schema.createTable(TABLE, (t: any) => {
    t.string("quote_id", 80).primary()
    t.string("tenant_id", 100).notNullable()
    t.string("cart_id", 100).notNullable()
    t.string("buyer_binding", 160).notNullable()
    t.string("fingerprint", 80).notNullable()
    t.jsonb("snapshot").notNullable()
    t.bigInteger("expires_at_ms").notNullable()
    t.bigInteger("accepted_at_ms").nullable()
    t.string("acceptance_nonce", 80).nullable()
    t.string("status", 12).notNullable()
    t.index(["tenant_id", "cart_id", "status"], "f07g_ci_tenant_cart_state")
  })

  try {
    const clock = 1793000000000
    const input: QuoteSnapshot = {
      tenantId: "merchant_A",
      cartId: "cart_synthetic_A",
      buyerBinding: "guest:sha256:" + "a".repeat(64),
      cartRevision: "v5",
      pricingRevision: "catalog_v12",
      currency: "all",
      total: "1510",
      items: [{ lineId: "line_1", variantId: "variant_short", quantity: 1,
        unitAmount: "1500", lineTotal: "1500" }],
      shipping: [{ id: "ship_1", amount: "10" }],
      adjustments: [],
      taxTotal: "0",
      discountTotal: "0",
      creditTotal: "0",
    }
    const quoteA = issueCheckoutQuote(input, clock, 120000)
    const quoteB = issueCheckoutQuote({
      ...input,
      tenantId: "merchant_B",
      cartId: "cart_synthetic_B",
      buyerBinding: "guest:sha256:" + "b".repeat(64),
    }, clock, 120000)

    const store = async (quote: CheckoutQuote) => {
      await db(TABLE).insert({
        quote_id: quote.id,
        tenant_id: quote.snapshot.tenantId,
        cart_id: quote.snapshot.cartId,
        buyer_binding: quote.snapshot.buyerBinding,
        fingerprint: quote.fingerprint,
        snapshot: JSON.stringify(quote.snapshot),
        status: quote.status,
        expires_at_ms: quote.expiresAtMs,
      })
    }
    await store(quoteA)
    await store(quoteB)

    /**
     * A missing/stale/wrong-tenant/wrong-buyer quote cannot be accepted.
     * These fields come from trusted server identity and a freshly fetched
     * cart in a future adapter. For now ALL inputs are synthetic fixture data.
     *
     * The conditional UPDATE is an atomic compare-and-swap, so parallel
     * requests cannot both transition the same quote from quoted→accepted.
     */
    const tryAccept = async (
      quote: CheckoutQuote,
      scope: { tenantId: string; cartId: string; buyerBinding: string },
      fresh: QuoteSnapshot,
      at: number
    ): Promise<boolean> => {
      return db.transaction(async (trx: any) => {
        const row = await trx(TABLE).where({
          quote_id: quote.id,
          tenant_id: scope.tenantId,
          cart_id: scope.cartId,
          buyer_binding: scope.buyerBinding,
        }).first()
        if (!row) return false
        const stored: CheckoutQuote = {
          id: row.quote_id,
          fingerprint: row.fingerprint,
          snapshot: typeof row.snapshot === "string" ? JSON.parse(row.snapshot) : row.snapshot,
          status: row.status,
          issuedAtMs: quote.issuedAtMs,
          expiresAtMs: Number(row.expires_at_ms),
        }
        // Refuse any substitution of IDs, currency, catalogue/cart state,
        // principal, or other snapshot fields BEFORE conditional mutation.
        if (fingerprintQuoteSnapshot(stored.snapshot) !== stored.fingerprint) return false
        let candidate: CheckoutQuote
        try {
          candidate = acceptCheckoutQuote(
            stored, { quoteId: quote.id, fingerprint: quote.fingerprint }, fresh, at,
          )
        } catch {
          return false
        }
        const changed = await trx(TABLE)
          .where({
            quote_id: quote.id,
            tenant_id: scope.tenantId,
            cart_id: scope.cartId,
            buyer_binding: scope.buyerBinding,
            fingerprint: candidate.fingerprint,
            status: "quoted",
          })
          .andWhere("expires_at_ms", ">", at)
          .update({
            status: "accepted",
            accepted_at_ms: at,
            acceptance_nonce: candidate.acceptanceNonce,
          })
          .returning("quote_id")
        return changed.length === 1
      })
    }

    const aScope = {
      tenantId: input.tenantId,
      cartId: input.cartId,
      buyerBinding: input.buyerBinding,
    }
    const bScope = {
      tenantId: quoteB.snapshot.tenantId,
      cartId: quoteB.snapshot.cartId,
      buyerBinding: quoteB.snapshot.buyerBinding,
    }
    assert.equal(await tryAccept(quoteA, bScope, input, clock + 10), false,
      "Foreign tenant must not update A quote")
    assert.equal(await tryAccept(quoteA, { ...aScope, buyerBinding: bScope.buyerBinding },
      input, clock + 10), false)
    assert.equal(await tryAccept(quoteA, aScope, { ...input, total: "1527" },
      clock + 10), false, "Changed amount needs fresh buyer acceptance")
    assert.equal(await tryAccept(quoteA, aScope, { ...input, pricingRevision: "catalog_v13" },
      clock + 10), false, "Unchanged total with new catalogue revision is stale")
    assert.equal(await tryAccept(quoteA, aScope, input, clock + 120000), false,
      "Expired quote must not be accepted")

    // A separate isolated merchant's quote can be accepted; it never changes
    // the status of A's quote.
    assert.equal(await tryAccept(quoteB, bScope, quoteB.snapshot, clock + 10), true)
    assert.equal((await db(TABLE).where({quote_id:quoteA.id}).first()).status, "quoted")
    console.log("SHQIPSHOP_F07G_POSTGRES_TENANT_PRINCIPAL_AND_EXPIRY_DENIAL_PASSED")

    // Deliberately overlap two different PostgreSQL transactions. A successful
    // conditional status change is unique even when both inspect quoted state.
    const contenders = await Promise.all([
      tryAccept(quoteA, aScope, input, clock + 30),
      tryAccept(quoteA, aScope, input, clock + 30),
    ])
    assert.equal(contenders.filter(Boolean).length, 1,
      "Exactly one buyer acceptance is allowed under parallel transactions")
    assert.equal(await tryAccept(quoteA, aScope, input, clock + 40), false,
      "Accepted quote cannot be replayed as a second acceptance")

    const persisted = await db(TABLE).where({quote_id:quoteA.id, tenant_id:aScope.tenantId}).first()
    assert.equal(persisted.status, "accepted")
    assert(persisted.acceptance_nonce)
    assert.equal(Number(persisted.accepted_at_ms), clock + 30)
    const persistedAccepted: CheckoutQuote = {
      ...quoteA,
      status: persisted.status,
      acceptedAtMs: Number(persisted.accepted_at_ms),
      acceptanceNonce: persisted.acceptance_nonce,
    }
    assert.doesNotThrow(() => assertAcceptedCheckoutQuote(persistedAccepted, input, clock + 50))
    assert.throws(() => assertAcceptedCheckoutQuote(persistedAccepted,
      { ...input, cartRevision: "v6" }, clock + 50), conflict)
    assert.equal((await db(TABLE).where({quote_id:quoteB.id}).first()).status, "accepted")
    console.log("SHQIPSHOP_F07G_POSTGRES_ATOMIC_SINGLE_ACCEPTANCE_AND_REPLAY_DENIED")

    // A failure inside a database transaction must not leak half-written state.
    const rollbackQuote = issueCheckoutQuote(
      {...input, cartId: "cart_synthetic_rollback"}, clock, 120000)
    await store(rollbackQuote)
    await assert.rejects(db.transaction(async (trx: any) => {
      await trx(TABLE).where({quote_id:rollbackQuote.id, status:"quoted"})
        .update({status:"accepted", accepted_at_ms:clock + 40})
      throw new Error("Synthetic transaction rollback probe")
    }), /Synthetic transaction rollback probe/)
    assert.equal((await db(TABLE).where({quote_id:rollbackQuote.id}).first()).status, "quoted")
    console.log("SHQIPSHOP_F07G_POSTGRES_TRANSACTION_ROLLBACK_PASSED")
  } finally {
    await db.schema.dropTableIfExists(TABLE)
  }
}
