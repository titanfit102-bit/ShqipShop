/**
 * Verify a cart created through native Android UI was persisted in Medusa.
 * Uses a fresh ephemeral CI backend, no user records, no real payment.
 */
import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export default async function assertAndroidCart({ container }: ExecArgs) {
  if (process.env.CI !== "true" || process.env.NODE_ENV !== "development") {
    throw new Error("Refusing Android-cart assertion outside ephemeral development CI")
  }
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: carts } = await query.graph({
    entity: "cart",
    fields: [
      "id",
      "currency_code",
      "items.id",
      "items.product_title",
      "items.quantity",
    ],
  })
  const nonEmpty = carts.filter((cart) => cart.items?.some((item) => Number(item.quantity) > 0))
  if (nonEmpty.length !== 1) {
    throw new Error(`Expected exactly one non-empty cart from Android, got ${nonEmpty.length}`)
  }
  const cart = nonEmpty[0]
  if (cart.currency_code !== "all") throw new Error("Android cart currency was not ALL")
  const shorts = cart.items?.find((item) => item.product_title === "Medusa Shorts")
  if (!shorts || Number(shorts.quantity) !== 1) {
    throw new Error("Android product UI did not persist exactly one Medusa Shorts item")
  }
  console.log("SHQIPSHOP_ANDROID_CART_PERSISTED_IN_POSTGRES_PASSED")
  console.log(JSON.stringify({
    currency: cart.currency_code,
    itemCount: cart.items?.length,
    product: "Medusa Shorts",
    quantity: shorts.quantity,
  }))
}
