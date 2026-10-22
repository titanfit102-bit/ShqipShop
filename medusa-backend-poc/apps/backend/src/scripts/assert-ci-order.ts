/** Verify checkout created an order in real Medusa DB, not just an HTTP response. */
import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { readFileSync } from "node:fs"

export default async function assertCiOrder({ container }: ExecArgs) {
  if (process.env.CI !== "true" || process.env.NODE_ENV !== "development") {
    throw new Error("Do not run this test against non-disposable databases")
  }
  const path = process.env.SHQIPSHOP_CI_ORDER_ID_FILE
  if (!path) throw new Error("Missing demo order ID file")
  const orderId = readFileSync(path, "utf8").trim()
  if (!/^order_[a-zA-Z0-9]+$/.test(orderId)) {
    throw new Error("Invalid Medusa demo order identifier")
  }
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    fields: ["id", "currency_code", "total"],
    filters: { id: orderId },
  })
  const order = data?.find((item) => item.id === orderId)
  if (!order || order.currency_code !== "all" || !Number.isFinite(Number(order.total)) || Number(order.total) <= 0) {
    throw new Error("CI order was not persisted in Medusa with ALL currency and positive total")
  }
  console.log("SHQIPSHOP_ORDER_PERSISTED_IN_POSTGRES_PASSED")
  console.log(JSON.stringify({currency:order.currency_code,total:order.total,ordersVerified:1}))
}
