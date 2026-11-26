import assert from "node:assert/strict"
import type { ExecArgs } from "@medusajs/framework/types"
import { createPromotionsWorkflow } from "@medusajs/medusa/core-flows"
import { isF07gN03Ci } from "../lib/checkout/quote-cart-ci"

export default async function createDiscount({ container }: ExecArgs) {
  assert(isF07gN03Ci() && process.env.SHQIPSHOP_N03_ANDROID_CI === "true" &&
    process.env.SHQIPSHOP_N03_ANDROID_SCENARIO === "discount",
    "Only the disposable registered Android discount scenario may create this promotion")

  await createPromotionsWorkflow(container).run({
    input: {
      promotionsData: [{
        code: "SHQIPSHOP-N03-ALL-100",
        type: "standard",
        status: "active",
        is_automatic: false,
        application_method: {
          type: "fixed",
          target_type: "items",
          allocation: "across",
          currency_code: "all",
          value: 100,
        },
      }],
    },
  })
}
