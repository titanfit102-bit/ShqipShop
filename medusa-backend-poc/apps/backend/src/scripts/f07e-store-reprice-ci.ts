/**
 * Disposable Medusa v2 repricing proof. Reads ephemeral HTTP test identifiers
 * and modifies only the linked ALL-currency price record in an isolated CI DB.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { upsertVariantPricesWorkflow } from "@medusajs/medusa/core-flows"

export default async function reprice({ container }: ExecArgs) {
  assert.equal(process.env.CI, "true")
  assert.equal(process.env.NODE_ENV, "development")
  assert.equal(process.env.SHQIPSHOP_REQUIRE_REDIS, "true")
  assert.equal(process.env.SHQIPSHOP_F07E_REPRICE_PROBE, "true")
  assert.equal(process.env.DATABASE_URL, "postgres://medusa_ci:disposable_ci_password@127.0.0.1:5432/medusa_ci")
  assert.equal(process.env.REDIS_URL, "redis://127.0.0.1:6379")
  const file = process.env.SHQIPSHOP_F07E_REPRICE_PROOF_FILE
  const temp = process.env.RUNNER_TEMP
  assert(file && temp && resolve(file).startsWith(resolve(temp) + "/"), "Only CI runner temp accepted")
  const proof = JSON.parse(readFileSync(file, "utf8")) as {
    productId: string; variantId: string; originalAmount: number; expectedAmount: number
  }
  assert(typeof proof.productId === "string" && proof.productId.startsWith("prod_"))
  assert(typeof proof.variantId === "string" && proof.variantId.startsWith("variant_"))
  assert(Number.isSafeInteger(proof.originalAmount) && proof.originalAmount > 0)
  assert.equal(proof.expectedAmount, proof.originalAmount + 17)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const [{ data: links }, { data: prices }, { data: variants }] = await Promise.all([
    query.graph({ entity: "product_variant_price_set", fields: ["variant_id", "price_set_id"],
      filters: { variant_id: proof.variantId } }),
    query.graph({ entity: "price", fields: ["id", "price_set_id", "currency_code", "amount"] }),
    query.graph({ entity: "product_variant", fields: ["id", "product_id"],
      filters: { id: proof.variantId } }),
  ])
  assert.equal(variants.length, 1, "Variant no longer present")
  assert.equal(variants[0].product_id, proof.productId, "Product/variant mismatch")
  const sets = new Set(links.map(x => x.price_set_id))
  const priceMatches = prices.filter(p => sets.has(p.price_set_id) && p.currency_code === "all")
  assert.equal(priceMatches.length, 1, "Exactly one linked ALL price required")
  const linked = priceMatches[0]
  assert.equal(Number(linked.amount), proof.originalAmount, "Seed price differs from Store API baseline")
  await upsertVariantPricesWorkflow(container).run({
    input: {
      variantPrices: [{
        product_id: proof.productId, variant_id: proof.variantId,
        prices: [{ id: linked.id, amount: proof.expectedAmount }],
      }],
      previousVariantIds: [proof.variantId],
    },
  })
  const { data: persisted } = await query.graph({
    entity: "price", fields: ["id", "amount"], filters: { id: linked.id },
  })
  assert.equal(Number(persisted[0]?.amount), proof.expectedAmount, "Price mutation not committed")
  console.log("SHQIPSHOP_F07E_WORKFLOW_LINKED_VARIANT_PRICE_UPDATED")
}
