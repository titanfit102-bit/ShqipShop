/**
 * F07g Stage 2C-2 — CI-ONLY PostgreSQL pre-payment claim proof.
 *
 * This is NOT a payment/order hook, a durable Medusa quote model, a charge
 * authorization, or safe-to-enable production code. Only call it for the
 * disposable quote fixture table after independently verified Medusa pricing.
 *
 * A successful database claim establishes one local intent winner; it DOES
 * NOT atomically consume a Medusa cart, create an order, reserve stock, call
 * a PSP, or guarantee an exactly-once payment. Those workflows need their
 * own shared transaction/compensation/idempotency design and authorization.
 */
import { randomUUID } from "node:crypto"
import {
  assertAcceptedCheckoutQuote,
  type CheckoutQuote, type QuoteSnapshot,
} from "./quote-contract"

export type VerifiedQuoteScope = {
  tenantId: string
  cartId: string
  buyerBinding: string
}

const readQuote = (row: any): CheckoutQuote => ({
  id: row.quote_id,
  fingerprint: row.fingerprint,
  snapshot: typeof row.snapshot === "string" ? JSON.parse(row.snapshot) : row.snapshot,
  status: row.status,
  issuedAtMs: Number(row.issued_at_ms),
  expiresAtMs: Number(row.expires_at_ms),
  ...(row.accepted_at_ms == null ? {} : { acceptedAtMs: Number(row.accepted_at_ms) }),
  ...(row.acceptance_nonce ? { acceptanceNonce: row.acceptance_nonce } : {}),
})

/** Never trust a client-supplied amount, tenant or accepted quote object. */
export async function claimAcceptedQuoteInDisposableCi(
  db: any,
  table: "shqipshop_f07g_disposable_ci_live_quotes",
  scope: VerifiedQuoteScope,
  quoteId: string,
  reviewedFingerprint: string,
  freshFromMedusa: QuoteSnapshot,
  nowMs: number,
): Promise<boolean> {
  if (process.env.CI !== "true" ||
    process.env.NODE_ENV !== "development" ||
    process.env.SHQIPSHOP_F07G_REAL_CART_CI !== "true" ||
    process.env.DATABASE_URL !==
      "postgres://medusa_ci:disposable_ci_password@127.0.0.1:5432/medusa_ci" ||
    process.env.REDIS_URL !== "redis://127.0.0.1:6379") {
    throw new Error("F07g claim forbidden outside disposable CI")
  }
  if (!scope || !quoteId || !reviewedFingerprint) return false
  try {
    return await db.transaction(async (trx: any) => {
    const where = {
      quote_id: quoteId, tenant_id: scope.tenantId,
      cart_id: scope.cartId, buyer_binding: scope.buyerBinding,
      fingerprint: reviewedFingerprint, status: "accepted",
    }
    const row = await trx(table).where(where).first()
    if (!row) return false
    try {
      assertAcceptedCheckoutQuote(readQuote(row), freshFromMedusa, nowMs)
    } catch {
      return false
    }
    // DB-side one-winner transition, including a strict server-side expiry.
    // A fresh server-generated nonce denotes the sole CI claim winner only.
    const changed = await trx(table).where(where)
      .andWhere("expires_at_ms", ">", nowMs)
      .update({
        status: "claimed",
        claimed_at_ms: nowMs,
        claim_nonce: randomUUID(),
      }).returning("quote_id")
    return changed.length === 1
    })
  } catch (error: unknown) {
    // The disposable per-cart partial unique index prohibits a second
    // claimed quote ID for the same cart. A losing writer gets PG 23505.
    // Only the expected uniqueness race maps to a safe denial.
    if (error && typeof error === "object" &&
        "code" in error && error.code === "23505") return false
    throw error
  }
}
