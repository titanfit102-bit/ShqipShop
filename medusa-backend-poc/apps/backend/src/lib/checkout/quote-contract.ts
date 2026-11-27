import { createHash, randomUUID } from "node:crypto"

/**
 * F07g / Stage 1: server-side QUOTE CONTRACT PRIMITIVE, not a checkout gate.
 *
 * Only a trusted backend adapter may build QuoteSnapshot from a fresh Medusa
 * cart and an independently verified catalogue/pricing revision. In
 * particular, the buyer cannot supply the payable total or buyerBinding.
 * The helper does not provide persistence, a transaction, a lock, a payment
 * authorization boundary, or proof that a UI displayed the reviewed amount.
 * Do NOT enable it as a production payment policy on its own.
 */
export type QuoteItem = {
  lineId: string
  variantId: string
  quantity: number
  unitAmount: string
  lineTotal: string
}
export type QuoteCharge = { id: string; amount: string }
export type QuoteSnapshot = {
  tenantId: string
  cartId: string
  // customer:<server-validated customer ID> or
  // guest:sha256:<digest of server-validated original cart capability>.
  // Never include raw tokens, email or other PII in a quote.
  buyerBinding: string
  cartRevision: string
  pricingRevision: string
  currency: string
  total: string
  items: QuoteItem[]
  shipping: QuoteCharge[]
  adjustments: QuoteCharge[]
  taxTotal: string
  discountTotal: string
  creditTotal: string
}

export type CheckoutQuote = {
  id: string
  fingerprint: string
  snapshot: QuoteSnapshot
  status: "quoted" | "accepted"
  issuedAtMs: number
  expiresAtMs: number
  acceptedAtMs?: number
  acceptanceNonce?: string
}

const reject = (): never => { throw new Error("F07g checkout quote conflict") }
const id = (value: unknown): string => {
  if (typeof value !== "string" || !/^[A-Za-z0-9_.:-]{1,160}$/.test(value)) return reject()
  return value
}
const amount = (value: unknown): string => {
  // Never round an imprecise float, parse scientific notation, or use
  // indicative EUR conversion as the authoritative payable amount.
  if (typeof value !== "string" || !/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(value)) return reject()
  const [whole, fraction] = value.split(".")
  const cleanFraction = fraction?.replace(/0+$/, "")
  return cleanFraction ? whole + "." + cleanFraction : whole
}
const verifiedClock = (value: number): number => {
  if (!Number.isSafeInteger(value) || value < 0) return reject()
  return value
}
const uniq = <T extends { id: string }>(list: T[]): T[] => {
  if (new Set(list.map((entry) => entry.id)).size !== list.length) return reject()
  return list.sort((a, b) => a.id.localeCompare(b.id, "en"))
}
const charges = (value: QuoteCharge[]): QuoteCharge[] => {
  if (!Array.isArray(value) || value.length > 100) return reject()
  return uniq(value.map((entry) => ({ id: id(entry?.id), amount: amount(entry?.amount) })))
}

/** Normalize and defensively copy the explicitly versioned monetary inputs. */
export function canonicalQuoteSnapshot(value: QuoteSnapshot): QuoteSnapshot {
  if (!value || typeof value !== "object") return reject()
  if (typeof value.buyerBinding !== "string" ||
    !/^(?:customer:[A-Za-z0-9_.:-]{1,128}|guest:sha256:[a-f0-9]{64})$/.test(value.buyerBinding)) return reject()
  if (typeof value.currency !== "string" || !/^[a-z]{3}$/.test(value.currency)) return reject()
  if (!Array.isArray(value.items) || value.items.length < 1 || value.items.length > 100) return reject()
  const items = value.items.map((entry) => ({
    lineId: id(entry?.lineId),
    variantId: id(entry?.variantId),
    quantity: entry?.quantity,
    unitAmount: amount(entry?.unitAmount),
    lineTotal: amount(entry?.lineTotal),
  }))
  if (items.some((entry) => !Number.isSafeInteger(entry.quantity) ||
    entry.quantity < 1 || entry.quantity > 100000)) return reject()
  if (new Set(items.map((entry) => entry.lineId)).size !== items.length) return reject()
  items.sort((a, b) => a.lineId.localeCompare(b.lineId, "en"))
  return {
    tenantId: id(value.tenantId),
    cartId: id(value.cartId),
    buyerBinding: value.buyerBinding,
    cartRevision: id(value.cartRevision),
    pricingRevision: id(value.pricingRevision),
    currency: value.currency,
    total: amount(value.total),
    items,
    shipping: charges(value.shipping),
    adjustments: charges(value.adjustments),
    taxTotal: amount(value.taxTotal),
    discountTotal: amount(value.discountTotal),
    creditTotal: amount(value.creditTotal),
  }
}

/** A deterministic integrity comparison, NOT an authentication signature. */
export function fingerprintQuoteSnapshot(value: QuoteSnapshot): string {
  const snapshot = canonicalQuoteSnapshot(value)
  return "sha256:" + createHash("sha256").update(
    JSON.stringify({ contract: "shqipshop-f07g-v1", snapshot }), "utf8"
  ).digest("hex")
}

/** Server-only issue; caller MUST persist using tenant-isolated database state. */
export function issueCheckoutQuote(
  source: QuoteSnapshot, nowMs: number, ttlMs: number
): CheckoutQuote {
  verifiedClock(nowMs)
  if (!Number.isSafeInteger(ttlMs) || ttlMs < 1000 || ttlMs > 5 * 60 * 1000) return reject()
  const snapshot = canonicalQuoteSnapshot(source)
  return {
    id: "quote_" + randomUUID(),
    fingerprint: fingerprintQuoteSnapshot(snapshot),
    snapshot,
    status: "quoted",
    issuedAtMs: nowMs,
    expiresAtMs: nowMs + ttlMs,
  }
}

function checkQuote(quote: CheckoutQuote, fresh: QuoteSnapshot, nowMs: number): void {
  verifiedClock(nowMs)
  if (!quote || !/^quote_[a-f0-9-]{36}$/.test(quote.id) ||
    !Number.isSafeInteger(quote.expiresAtMs) ||
    nowMs < quote.issuedAtMs || nowMs >= quote.expiresAtMs) return reject()
  // Check independently sourced current server cart AND stored, immutable
  // reviewed cart. In real integration, run within one transactional boundary.
  if (fingerprintQuoteSnapshot(quote.snapshot) !== quote.fingerprint ||
      fingerprintQuoteSnapshot(fresh) !== quote.fingerprint) return reject()
}

/**
 * A deliberate client acceptance request MUST submit both quoteId and the
 * fingerprint of the server-reviewed total. Returned object requires a
 * tenant-local compare-and-swap from quoted to accepted: this function is not
 * an atomic database write and cannot prevent parallel acceptance on its own.
 */
export function acceptCheckoutQuote(
  quote: CheckoutQuote,
  submission: { quoteId: string; fingerprint: string },
  freshServerSnapshot: QuoteSnapshot,
  nowMs: number
): CheckoutQuote {
  checkQuote(quote, freshServerSnapshot, nowMs)
  if (quote.status !== "quoted" || submission?.quoteId !== quote.id ||
    submission?.fingerprint !== quote.fingerprint) return reject()
  return {
    ...quote,
    status: "accepted",
    acceptedAtMs: nowMs,
    acceptanceNonce: randomUUID(),
  }
}

/** A snapshot check, NOT a transactional payment/order completion lock. */
export function assertAcceptedCheckoutQuote(
  quote: CheckoutQuote, freshServerSnapshot: QuoteSnapshot, nowMs: number
): void {
  checkQuote(quote, freshServerSnapshot, nowMs)
  if (quote.status !== "accepted" || quote.acceptedAtMs === undefined ||
    quote.acceptedAtMs < quote.issuedAtMs || quote.acceptedAtMs >= quote.expiresAtMs ||
    !quote.acceptanceNonce) return reject()
}
