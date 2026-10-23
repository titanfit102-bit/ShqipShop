/** Proof that a completed Android UI checkout persisted as a Medusa order.
 * Runs only in disposable CI. No real payment or merchant/customer records.
 */
import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export default async function assertAndroidUiOrder({ container }: ExecArgs) {
  if (process.env.CI !== "true" || process.env.NODE_ENV !== "development") {
    throw new Error("Never execute Android order assertions on a non-disposable DB")
  }
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "currency_code",
      "total",
      "email",
      "shipping_address.country_code",
      "items.title",
      "items.quantity",
    ],
  })
  if (orders.length !== 1) {
    throw new Error(`Expected exactly one Android UI order, found ${orders.length}`)
  }
  const order = orders[0]
  if (order.currency_code !== "all" || Number(order.total) !== 1510) {
    throw new Error("Android UI order has wrong ALL currency or payable amount")
  }
  if (order.email !== "buyer-ci@example.invalid") {
    throw new Error("Android UI order did not preserve the synthetic checkout email")
  }
  if (order.shipping_address?.country_code !== "al") {
    throw new Error("Android UI order not delivered to Albania")
  }
  if (!order.items?.some(item => item.title === "Medusa Shorts" && Number(item.quantity) === 1)) {
    throw new Error("Android UI order missing exactly one Medusa Shorts")
  }
  console.log("SHQIPSHOP_ANDROID_NATIVE_ORDER_POSTGRES_PASSED")
  console.log(JSON.stringify({
    currency: order.currency_code,
    total: order.total,
    country: "al",
    orderCount: orders.length,
    items: order.items?.length,
  }))
}
