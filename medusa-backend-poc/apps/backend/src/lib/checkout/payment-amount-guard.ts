import { MathBN, MedusaError } from "@medusajs/framework/utils"

/**
 * F07f: Fail-closed amount check on the exact cart snapshot supplied to
 * completeCartWorkflow.validate, before the order/payment are authorized.
 *
 * IMPORTANT: This guards payment-vs-cart divergence ONLY. It does not record
 * buyer consent, refresh pricing or validate a changed catalogue price.
 */
type PaymentLike = { status?: string | null; amount?: unknown; provider_id?: string | null }
export type CheckoutAmountSnapshot = {
  total?: unknown
  credit_line_total?: unknown
  payment_collection?: {
    payment_sessions?: PaymentLike[] | null
  } | null
}

const processable = new Set([
  "pending", "requires_more", "authorized", "captured", "pending_authorization",
])
const conflict = () =>
  new MedusaError(MedusaError.Types.CONFLICT, "Checkout payment amount needs revalidation")

function finiteNonnegative(value: unknown): number | null {
  // Decimal scalar values returned by Medusa may be numbers or numeric strings.
  if (typeof value !== "number" && typeof value !== "string") return null
  if (typeof value === "string" && !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) return null
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : null
}

/** Does NOT mutate cart or payment session; throws HTTP 409-style conflict. */
export function assertCheckoutPaymentAmount(cart: CheckoutAmountSnapshot): void {
  const total = finiteNonnegative(cart?.total)
  if (total === null) throw conflict()
  const sessions = cart?.payment_collection?.payment_sessions?.filter(
    s => s && processable.has(String(s.status))
  ) ?? []

  // Full-credit/zero checkout is a separate Medusa-supported path.
  // Never create an artificial payment charge when the cart total is zero.
  if (total === 0 && sessions.length === 0) return

  // Medusa completeCartWorkflow authorizes the FIRST processable session,
  // not a sum of sessions. Multiple sessions require deliberate policy.
  if (sessions.length !== 1) throw conflict()
  const authorizedAmount = finiteNonnegative(sessions[0]?.amount)
  if (authorizedAmount === null) throw conflict()

  // MathBN comparison preserves decimal amounts in supported currencies.
  if (!MathBN.convert(authorizedAmount).eq(MathBN.convert(total))) {
    throw conflict()
  }
}
