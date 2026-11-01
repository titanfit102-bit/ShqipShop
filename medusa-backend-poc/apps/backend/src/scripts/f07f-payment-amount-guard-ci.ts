import assert from "node:assert/strict"
import type { ExecArgs } from "@medusajs/framework/types"
import { assertCheckoutPaymentAmount } from "../lib/checkout/payment-amount-guard"

/** Isolated deterministic negative checks, in addition to live HTTP checkout. */
export default async function prove(_args: ExecArgs) {
  if (process.env.CI !== "true" ||
      process.env.NODE_ENV !== "development" ||
      process.env.SHQIPSHOP_ENFORCE_PAYMENT_TOTAL_MATCH !== "true" ||
      process.env.DATABASE_URL !== "postgres://medusa_ci:disposable_ci_password@127.0.0.1:5432/medusa_ci") {
    throw new Error("Payment amount test restricted to disposable CI")
  }
  const active = (amount: unknown, status = "pending") => ({
    total: 3044, payment_collection: { payment_sessions: [{ status, amount, provider_id: "pp_system_default" }] },
  })
  assert.doesNotThrow(() => assertCheckoutPaymentAmount(active(3044)))
  console.log("SHQIPSHOP_F07F_MATCHED_PAYMENT_AMOUNT_ACCEPTED")
  for (const amount of [3034, 3054, 0, undefined, Number.NaN, -1, "3044USD"]) {
    assert.throws(() => assertCheckoutPaymentAmount(active(amount)),
      /Checkout payment amount needs revalidation/)
  }
  assert.throws(() => assertCheckoutPaymentAmount({
    total: 3044, payment_collection: { payment_sessions: [
      { status: "pending", amount: 3044 },
      { status: "authorized", amount: 3044 },
    ] },
  }), /Checkout payment amount needs revalidation/)
  assert.throws(() => assertCheckoutPaymentAmount({
    total: 3044, payment_collection: { payment_sessions: [] },
  }), /Checkout payment amount needs revalidation/)
  assert.doesNotThrow(() => assertCheckoutPaymentAmount({ total: 0, payment_collection: null }))
  console.log("SHQIPSHOP_F07F_STALE_AND_AMBIGUOUS_PAYMENT_AMOUNTS_DENIED")
}
