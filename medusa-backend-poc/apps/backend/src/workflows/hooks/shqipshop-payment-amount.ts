import { completeCartWorkflow } from "@medusajs/medusa/core-flows"
import { assertCheckoutPaymentAmount } from "../../lib/checkout/payment-amount-guard"

/**
 * This hook runs inside Medusa's cart-completion workflow, not merely in the
 * storefront. Opt-in until every external/partial-payment case is reviewed.
 * No price mutation, payment refresh or frontend consent is performed here.
 */
completeCartWorkflow.hooks.validate(async ({ cart }) => {
  if (process.env.SHQIPSHOP_ENFORCE_PAYMENT_TOTAL_MATCH !== "true") return
  assertCheckoutPaymentAmount(cart)
})
