/**
 * F07g Stage 2B-1: read-only proof against a REAL disposable Medusa cart
 * and linked catalogue ALL-currency price rows.
 *
 * Not an HTTP quote endpoint, security authorization, persistence migration,
 * live payment or Medusa cart-completion hook. A real buyer/capability proof,
 * pricing-rule engine, tax/discount/shipping recalculation, and atomic checkout
 * workflow are NOT implemented here. Never enable in Production.
 */
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MathBN } from "@medusajs/framework/utils"
import { bindVerifiedQuotePrincipal } from "../lib/checkout/quote-principal"
import { claimAcceptedQuoteInDisposableCi } from "../lib/checkout/quote-claim-ci"
import {
  acceptCheckoutQuote, assertAcceptedCheckoutQuote, fingerprintQuoteSnapshot,
  issueCheckoutQuote, type CheckoutQuote, type QuoteSnapshot,
} from "../lib/checkout/quote-contract"

const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex")
const fail = (reason: string): never => { throw new Error("F07g Medusa cart proof: " + reason) }
const money = (x: unknown): string => {
  // Medusa Query Graph returns computed monetary fields as framework
  // BigNumber objects; MathBN supports both those and stored numeric values.
  // Decimal text comes from bignumber.js, never a lossy JS Number coercion.
  if (x === null || x === undefined) return fail("missing financial field")
  let value: string
  try {
    value = MathBN.convert(x as number).toString()
  } catch {
    return fail("invalid financial field")
  }
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(value)) return fail("invalid financial field")
  return value
}
const identifier = (value: unknown, prefix: string) => {
  if (typeof value !== "string" || !value.startsWith(prefix) ||
    !/^[a-zA-Z0-9_-]{8,}$/.test(value)) return fail("invalid ID")
  return value
}

export default async function liveCart({ container, args }: ExecArgs) {
  const required: Record<string, string> = {
    CI: "true", NODE_ENV: "development",
    SHQIPSHOP_REQUIRE_REDIS: "true", SHQIPSHOP_F07E_REPRICE_PROBE: "true",
    SHQIPSHOP_F07G_REAL_CART_CI: "true",
    DATABASE_URL: "postgres://medusa_ci:disposable_ci_password@127.0.0.1:5432/medusa_ci",
    REDIS_URL: "redis://127.0.0.1:6379",
  }
  for (const [name, expected] of Object.entries(required)) assert.equal(process.env[name], expected)
  const phase = args?.[0]
  assert(phase === "before" || phase === "after", "Expected before/after price mutation")
  const temp = process.env.RUNNER_TEMP
  const proof = process.env.SHQIPSHOP_F07E_REPRICE_PROOF_FILE
  const checkpoint = process.env.SHQIPSHOP_F07G_REAL_CART_PROOF_FILE
  assert(temp && proof && checkpoint, "Runner-only proof paths required")
  for (const p of [proof, checkpoint]) {
    assert(resolve(p).startsWith(resolve(temp) + "/"), "Proof must remain inside runner temp")
  }
  const prepared = JSON.parse(readFileSync(proof, "utf8")) as {
    cartId: string; variantId: string; originalAmount: number; expectedAmount: number
  }
  const cartId = identifier(prepared.cartId, "cart_")
  const variantId = identifier(prepared.variantId, "variant_")
  assert(Number.isSafeInteger(prepared.originalAmount) && prepared.originalAmount > 0)
  assert.equal(prepared.expectedAmount, prepared.originalAmount + 17)

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  // All data is retrieved by server-side QUERY; never use a client-supplied
  // total or tenant/buyer claim. Stage-2B-1 is intentionally an ALL-only,
  // no-discounts, no-shipping-price-rule proof for ONE actual Medusa line item.
  const [{ data: carts }, { data: links }, { data: prices }] = await Promise.all([
    query.graph({
      entity: "cart",
      fields: [
        "id", "currency_code", "region_id", "customer_id", "updated_at", "total",
        "tax_total", "discount_total", "credit_line_total",
        "items.id", "items.variant_id", "items.quantity", "items.unit_price", "items.total",
      ],
      filters: { id: cartId },
    }),
    query.graph({
      entity: "product_variant_price_set", fields: ["variant_id", "price_set_id"],
      filters: { variant_id: variantId },
    }),
    query.graph({ entity: "price",
      fields: ["id", "price_set_id", "currency_code", "amount", "updated_at"] }),
  ])
  assert.equal(carts.length, 1, "Expected exactly one real Medusa cart")
  const cart = carts[0]
  assert.equal(cart.id, cartId)
  assert.equal(cart.currency_code, "all")
  assert(Array.isArray(cart.items) && cart.items.length === 1,
    "This CI proof supports one line item only")
  const item = cart.items[0]
  assert.equal(item.variant_id, variantId)
  const lineId = identifier(item.id, "cali_")
  assert(Number.isSafeInteger(Number(item.quantity)) && Number(item.quantity) === 1,
    "CI proof cart must remain one unit")
  const matchingSets = new Set(links.map(row => String(row.price_set_id)))
  assert.equal(matchingSets.size, 1, "Only one variant price set accepted")
  const linked = prices.filter(row =>
    matchingSets.has(String(row.price_set_id)) && row.currency_code === "all")
  assert.equal(linked.length, 1, "Only one linked ALL price accepted")
  const price = linked[0]
  const effectivePrice = money(price.amount)
  const cartUnit = money(item.unit_price)
  const cartTotal = money(cart.total)
  const lineTotal = money(item.total)
  const taxTotal = money(cart.tax_total ?? 0)
  const discountTotal = money(cart.discount_total ?? 0)
  const creditTotal = money(cart.credit_line_total ?? 0)

  // CI verifies guest possession using the same cart ID retrieved freshly
  // from Medusa; production adapters MUST obtain proof from the request and
  // validate auth context themselves, never trust client tenant claims.
  const principal = bindVerifiedQuotePrincipal({
    deploymentTenantId: "merchant_ci_isolated",
    trustedCart: { id: cartId, customerId: cart.customer_id },
    validatedAuthContext: null,
    authorizationAttempted: false,
    guestCartProof: prepared.cartId,
    serverSecret: process.env.JWT_SECRET ?? "",
  })
  const snapshot: QuoteSnapshot = {
    tenantId: principal.tenantId,
    cartId: principal.cartId, buyerBinding: principal.buyerBinding,
    cartRevision: "cart_" + digest([
      cartId, cart.region_id, cart.updated_at,
      [lineId, variantId, item.quantity, cartUnit, lineTotal],
      cartTotal, taxTotal, discountTotal, creditTotal,
    ]),
    pricingRevision: "price_" + digest([
      String(price.id), String(price.price_set_id), effectivePrice, price.updated_at,
    ]),
    currency: "all", total: cartTotal,
    items: [{
      lineId, variantId, quantity: Number(item.quantity),
      unitAmount: cartUnit, lineTotal,
    }],
    shipping: [], adjustments: [], taxTotal, discountTotal, creditTotal,
  }

  // Only a disposable PostgreSQL fixture. This table does not exist in
  // production and is never a Medusa schema migration or payment policy.
  const db: any = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const table = "shqipshop_f07g_disposable_ci_live_quotes"
  const dbQuote = (row: any): CheckoutQuote => ({
    id: row.quote_id,
    fingerprint: row.fingerprint,
    snapshot: typeof row.snapshot === "string" ? JSON.parse(row.snapshot) : row.snapshot,
    status: row.status,
    issuedAtMs: Number(row.issued_at_ms),
    expiresAtMs: Number(row.expires_at_ms),
    ...(row.accepted_at_ms !== null && row.accepted_at_ms !== undefined
      ? { acceptedAtMs: Number(row.accepted_at_ms) } : {}),
    ...(row.acceptance_nonce ? { acceptanceNonce: row.acceptance_nonce } : {}),
  })
  const store = async (quote: CheckoutQuote) => {
    await db(table).insert({
      quote_id: quote.id, tenant_id: quote.snapshot.tenantId,
      cart_id: quote.snapshot.cartId, buyer_binding: quote.snapshot.buyerBinding,
      fingerprint: quote.fingerprint, snapshot: JSON.stringify(quote.snapshot),
      issued_at_ms: quote.issuedAtMs, expires_at_ms: quote.expiresAtMs,
      status: "quoted",
    })
  }
  const scope = {
    tenantId: snapshot.tenantId, cartId: snapshot.cartId,
    buyerBinding: snapshot.buyerBinding,
  }
  // No trust in any caller-supplied quote body. The stored snapshot, issued
  // time, principal scope and expiration come ONLY from the PostgreSQL row.
  const tryAccept = async (
    quoteId: string, submissionFingerprint: string,
    scopeArg: typeof scope, current: QuoteSnapshot, at: number,
  ): Promise<boolean> => db.transaction(async (trx: any) => {
    const row = await trx(table).where({
      quote_id: quoteId, tenant_id: scopeArg.tenantId,
      cart_id: scopeArg.cartId, buyer_binding: scopeArg.buyerBinding,
    }).first()
    if (!row) return false
    let candidate: CheckoutQuote
    try {
      candidate = acceptCheckoutQuote(
        dbQuote(row), { quoteId, fingerprint: submissionFingerprint }, current, at,
      )
    } catch {
      return false
    }
    const changed = await trx(table)
      .where({
        quote_id: quoteId, tenant_id: scopeArg.tenantId,
        cart_id: scopeArg.cartId, buyer_binding: scopeArg.buyerBinding,
        status: "quoted", fingerprint: candidate.fingerprint,
      })
      .andWhere("expires_at_ms", ">", at)
      .update({
        status: "accepted", accepted_at_ms: at,
        acceptance_nonce: candidate.acceptanceNonce,
      }).returning("quote_id")
    return changed.length === 1
  })

  if (phase === "before") {
    // Fail closed if the real Store cart price already disagrees with its
    // only linked ALL price, or cart arithmetic is inconsistent.
    assert.equal(cartUnit, effectivePrice, "Unrefreshed cart cannot be newly confirmed")
    assert(MathBN.convert(lineTotal).eq(MathBN.convert(cartUnit)), "CI line amount inconsistent")
    const expectedTotal = MathBN.sub(MathBN.add(lineTotal, taxTotal), discountTotal)
    assert(MathBN.convert(cartTotal).eq(expectedTotal),
      "CI total must come from coherent Medusa data")
    assert.equal(await db.schema.hasTable(table), false,
      "Never alter a pre-existing table, including other test fixtures")
    await db.schema.createTable(table, (t: any) => {
      t.string("quote_id", 80).primary()
      t.string("tenant_id", 100).notNullable()
      t.string("cart_id", 100).notNullable()
      t.string("buyer_binding", 160).notNullable()
      t.string("fingerprint", 80).notNullable()
      t.jsonb("snapshot").notNullable()
      t.bigInteger("issued_at_ms").notNullable()
      t.bigInteger("expires_at_ms").notNullable()
      t.bigInteger("accepted_at_ms").nullable()
      t.string("acceptance_nonce", 80).nullable()
      t.bigInteger("claimed_at_ms").nullable()
      t.string("claim_nonce", 80).nullable()
      t.string("status", 12).notNullable()
      t.index(["tenant_id", "cart_id", "status"], "f07g_live_ci_tenant_cart_state")
    })
    // Stronger than uniqueness per quote_id: prohibit two independent
    // accepted quote IDs being claimed for the SAME checkout cart.
    // Disposable PostgreSQL-only proof; this is NOT a Medusa order lock.
    await db.raw(`CREATE UNIQUE INDEX f07g_ci_one_claimed_per_cart
      ON "${table}" ("tenant_id", "cart_id")
      WHERE "status" = 'claimed'`)
    const now = Date.now()
    const quote = issueCheckoutQuote(snapshot, now, 300000)
    const pending = issueCheckoutQuote(snapshot, now, 300000)
    const claimedIntent = issueCheckoutQuote(snapshot, now, 300000)
    const staleAcceptedIntent = issueCheckoutQuote(snapshot, now, 300000)
    const parallelSiblingIntent = issueCheckoutQuote(snapshot, now, 300000)
    const httpQuote = issueCheckoutQuote(snapshot, now, 300000)
    const staleHttpQuote = issueCheckoutQuote(snapshot, now, 300000)
    await store(quote)
    await store(pending)
    await store(claimedIntent)
    await store(staleAcceptedIntent)
    await store(parallelSiblingIntent)
    await store(httpQuote)
    await store(staleHttpQuote)
    assert.equal(await tryAccept(quote.id, quote.fingerprint,
      {...scope, tenantId: "foreign_merchant"}, snapshot, now + 1), false)
    assert.equal(await tryAccept(quote.id, quote.fingerprint,
      {...scope, buyerBinding: "guest:sha256:" + "f".repeat(64)}, snapshot, now + 1), false)
    assert.equal(await tryAccept(quote.id, quote.fingerprint,
      scope, {...snapshot, pricingRevision: "price_wrong_revision"}, now + 1), false)
    assert.equal(await tryAccept(quote.id, quote.fingerprint,
      scope, snapshot, quote.expiresAtMs), false)
    const attempts = await Promise.all([
      tryAccept(quote.id, quote.fingerprint, scope, snapshot, now + 2),
      tryAccept(quote.id, quote.fingerprint, scope, snapshot, now + 2),
    ])
    assert.equal(attempts.filter(Boolean).length, 1,
      "Only one of two concurrent PostgreSQL updates may accept the real Medusa quote")
    assert.equal(await tryAccept(quote.id, quote.fingerprint,
      scope, snapshot, now + 3), false, "Replay must be rejected")
    const row = await db(table).where({quote_id:quote.id,...{
      tenant_id:scope.tenantId,cart_id:scope.cartId,buyer_binding:scope.buyerBinding,
    }}).first()
    const accepted = dbQuote(row)
    assertAcceptedCheckoutQuote(accepted, snapshot, now + 3)

    // Distinct accepted intents: claim one atomically, keep the other accepted
    // across the catalogue reprice to prove stale claims are denied.
    assert.equal(await tryAccept(claimedIntent.id, claimedIntent.fingerprint,
      scope, snapshot, now + 4), true)
    assert.equal(await tryAccept(staleAcceptedIntent.id, staleAcceptedIntent.fingerprint,
      scope, snapshot, now + 4), true)
    assert.equal(await tryAccept(parallelSiblingIntent.id, parallelSiblingIntent.fingerprint,
      scope, snapshot, now + 4), true)
    const claim = (id: string, fp: string, claimScope: typeof scope,
      fresh: QuoteSnapshot, at: number) => claimAcceptedQuoteInDisposableCi(
      db, table, claimScope, id, fp, fresh, at)
    assert.equal(await claim(claimedIntent.id, claimedIntent.fingerprint,
      {...scope, tenantId: "foreign_merchant"}, snapshot, now + 5), false)
    assert.equal(await claim(claimedIntent.id, claimedIntent.fingerprint,
      {...scope, buyerBinding: "guest:sha256:" + "f".repeat(64)}, snapshot, now + 5), false)
    assert.equal(await claim(claimedIntent.id, "sha256:" + "f".repeat(64),
      scope, snapshot, now + 5), false)
    assert.equal(await claim(claimedIntent.id, claimedIntent.fingerprint,
      scope, {...snapshot, pricingRevision: "price_wrong_revision"}, now + 5), false)
    assert.equal(await claim(claimedIntent.id, claimedIntent.fingerprint,
      scope, snapshot, claimedIntent.expiresAtMs), false)
    // Four competing requests across TWO independently issued accepted
    // quotes for the SAME real Medusa cart. Unique quote_id alone is not
    // sufficient to stop double checkout intent claims.
    const contenders = await Promise.all([
      claim(claimedIntent.id, claimedIntent.fingerprint, scope, snapshot, now + 6),
      claim(claimedIntent.id, claimedIntent.fingerprint, scope, snapshot, now + 6),
      claim(parallelSiblingIntent.id, parallelSiblingIntent.fingerprint, scope, snapshot, now + 6),
      claim(parallelSiblingIntent.id, parallelSiblingIntent.fingerprint, scope, snapshot, now + 6),
    ])
    assert.equal(contenders.filter(Boolean).length, 1,
      "Exactly ONE PostgreSQL claimed quote across distinct IDs for same Medusa cart")
    assert.equal(await claim(claimedIntent.id, claimedIntent.fingerprint,
      scope, snapshot, now + 7), false, "First quote replay or sibling conflict denied")
    assert.equal(await claim(parallelSiblingIntent.id, parallelSiblingIntent.fingerprint,
      scope, snapshot, now + 7), false, "Other quote replay or sibling conflict denied")
    const siblings = await db(table).whereIn("quote_id",
      [claimedIntent.id, parallelSiblingIntent.id])
    assert.equal(siblings.length, 2)
    assert.equal(siblings.filter((r: any) => r.status === "claimed").length, 1)
    assert.equal(siblings.filter((r: any) => r.status === "accepted").length, 1)
    const claimedRow = siblings.find((r: any) => r.status === "claimed")
    assert.equal(Number(claimedRow.claimed_at_ms), now + 6)
    assert.match(String(claimedRow.claim_nonce), /^[a-f0-9-]{36}$/)
    assert.equal(Number((await db(table).where({
      tenant_id:scope.tenantId, cart_id:scope.cartId, status:"claimed",
    }).count("* as count").first()).count), 1)
    console.log("SHQIPSHOP_F07G_REAL_MEDUSA_PG_DISTINCT_QUOTES_ONE_CART_SINGLE_CLAIM")
    const staleRow = await db(table).where({quote_id:staleAcceptedIntent.id}).first()
    assert.equal(staleRow.status, "accepted")
    writeFileSync(checkpoint, JSON.stringify({
      accepted, linkedAmount: effectivePrice, pendingQuoteId: pending.id,
      claimedIntentId: claimedRow.quote_id, claimedNonce: claimedRow.claim_nonce,
      staleAcceptedIntentId: staleAcceptedIntent.id,
      httpQuote: {id:httpQuote.id,fingerprint:httpQuote.fingerprint},
      staleHttpQuote: {id:staleHttpQuote.id,fingerprint:staleHttpQuote.fingerprint},
    }), { flag: "wx", mode: 0o600 })
    console.log("SHQIPSHOP_F07G_REAL_MEDUSA_PG_PREPAYMENT_INTENT_SINGLE_CLAIM_PASSED")
    console.log("SHQIPSHOP_F07G_REAL_MEDUSA_CART_SNAPSHOT_BEFORE_REPRICE_PASSED")
    console.log("SHQIPSHOP_F07G_REAL_MEDUSA_PG_ATOMIC_SINGLE_ACCEPTANCE_AND_REPLAY_DENIED")
    return
  }

  try {
    const prior = JSON.parse(readFileSync(checkpoint, "utf8")) as {
      accepted: CheckoutQuote; linkedAmount: string; pendingQuoteId: string
      claimedIntentId: string; claimedNonce: string; staleAcceptedIntentId: string
      httpQuote: {id:string;fingerprint:string}
      staleHttpQuote: {id:string;fingerprint:string}
    }
    assert.equal(Number(effectivePrice), prepared.expectedAmount,
      "Catalogue repricing did not persist in real Medusa PostgreSQL")
    assert.equal(Number(prior.linkedAmount), prepared.originalAmount)
    assert.notEqual(snapshot.pricingRevision, prior.accepted.snapshot.pricingRevision,
      "Catalogue price revision must change even when an active cart stays stale")
    assert.notEqual(fingerprintQuoteSnapshot(snapshot), prior.accepted.fingerprint,
      "Old acceptance must never be reusable after catalogue repricing")
    const acceptedRow = await db(table).where({
      quote_id: prior.accepted.id, tenant_id: scope.tenantId,
      cart_id: scope.cartId, buyer_binding: scope.buyerBinding,
    }).first()
    assert(acceptedRow && acceptedRow.status === "accepted",
      "Accepted quote must survive separate Medusa exec process")
    const persisted = dbQuote(acceptedRow)
    assert.equal(persisted.fingerprint, prior.accepted.fingerprint)
    assert.equal(persisted.acceptanceNonce, prior.accepted.acceptanceNonce)
    assert.throws(() => assertAcceptedCheckoutQuote(persisted, snapshot,
      persisted.acceptedAtMs! + 1), /F07g checkout quote conflict/)

    const pendingRow = await db(table).where({
      quote_id: prior.pendingQuoteId, tenant_id: scope.tenantId,
      cart_id: scope.cartId, buyer_binding: scope.buyerBinding,
    }).first()
    assert(pendingRow && pendingRow.status === "quoted")
    const unaccepted = dbQuote(pendingRow)
    assert.throws(() => acceptCheckoutQuote(unaccepted,
      { quoteId: unaccepted.id, fingerprint: unaccepted.fingerprint },
      snapshot, unaccepted.issuedAtMs + 5), /F07g checkout quote conflict/,
      "Catalogue repricing must reject an unaccepted persisted quote")
    assert.equal(await tryAccept(unaccepted.id, unaccepted.fingerprint,
      scope, snapshot, unaccepted.issuedAtMs + 5), false,
      "Repriced cart cannot transition a stored quote to accepted")
    assert.equal((await db(table).where({quote_id:unaccepted.id}).first()).status, "quoted")
    console.log("SHQIPSHOP_F07G_REAL_MEDUSA_PG_REPRICE_DENIES_PENDING_QUOTE_ACROSS_PROCESSES")

    const claimedRow = await db(table).where({
      quote_id: prior.claimedIntentId, tenant_id: scope.tenantId,
      cart_id: scope.cartId, buyer_binding: scope.buyerBinding,
    }).first()
    assert.equal(claimedRow.status, "claimed")
    assert.equal(claimedRow.claim_nonce, prior.claimedNonce,
      "Single winner intent claim must persist across processes")
    const staleClaimRow = await db(table).where({
      quote_id: prior.staleAcceptedIntentId, tenant_id: scope.tenantId,
      cart_id: scope.cartId, buyer_binding: scope.buyerBinding,
    }).first()
    assert.equal(staleClaimRow.status, "accepted")
    assert.equal(await claimAcceptedQuoteInDisposableCi(
      db, table, scope, staleClaimRow.quote_id, staleClaimRow.fingerprint,
      snapshot, Number(staleClaimRow.accepted_at_ms) + 2), false,
      "Repriced cart must deny even an already-accepted, unclaimed quote")
    assert.equal((await db(table).where({quote_id:staleClaimRow.quote_id}).first()).status,
      "accepted", "Stale quote claim may not mutate PostgreSQL state")
    const acceptedHttp = await db(table).where({quote_id:prior.httpQuote.id}).first()
    assert.equal(acceptedHttp.status, "accepted",
      "Reviewed quote must be accepted by real HTTP and survive Medusa subprocess")
    assert.equal(acceptedHttp.fingerprint, prior.httpQuote.fingerprint)
    const staleHttp = await db(table).where({quote_id:prior.staleHttpQuote.id}).first()
    assert.equal(staleHttp.status,"quoted",
      "HTTP must never accept a stored quote after actual catalogue repricing")
    console.log("SHQIPSHOP_F07G_REAL_MEDUSA_PG_HTTP_BUYER_ACCEPTANCE_PERSISTED")
    console.log("SHQIPSHOP_F07G_REAL_MEDUSA_PG_STALE_ACCEPTED_INTENT_CLAIM_DENIED")
    if (cartUnit !== effectivePrice) {
      console.log("SHQIPSHOP_F07G_REAL_MEDUSA_STALE_CART_UNIT_OBSERVED_NOT_APPROVED")
    } else {
      console.log("SHQIPSHOP_F07G_REAL_MEDUSA_CART_ALREADY_REPRICED_OBSERVED")
    }
    console.log("SHQIPSHOP_F07G_REAL_MEDUSA_REPRICE_INVALIDATES_BUYER_QUOTE_PASSED")
  } finally {
    // This is an explicitly disposable CI table; never migrate or drop a
    // production model/table. Cleanup runs even when the stale-price test fails.
    await db.schema.dropTableIfExists(table)
  }
}
