/** F07e: read-only cross-process cache assertions around real disposable
 * variant-price and cart mutations. No real payments, PII or production APIs.
 * Requires isolated A/B Medusa databases, Redis and live dedicated workers.
 */
import assert from "node:assert/strict"
import { readFileSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"
import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  createCartWorkflow,
  updateCartWorkflow,
  upsertVariantPricesWorkflow,
} from "@medusajs/medusa/core-flows"

type Proof = {
  tenant: "A" | "B"
  id: string
  before: string | number | null
  after: string | number
  productId?: string
  variantId?: string
}
const cacheConfig = { cache: { enable: true, ttl: 900 } }

export default async function f07eCommerceCache({ container, args }: ExecArgs) {
  if (
    process.env.CI !== "true" ||
    process.env.NODE_ENV !== "development" ||
    process.env.SHQIPSHOP_F07D_PROBE !== "true" ||
    process.env.SHQIPSHOP_REQUIRE_REDIS !== "true" ||
    process.env.MEDUSA_FF_CACHING !== "true" ||
    process.env.WORKER_MODE !== "server"
  ) throw new Error("F07e requires disposable CI with caching and workers")
  const tenant = process.env.SHQIPSHOP_F07D_TENANT
  if (tenant !== "A" && tenant !== "B") throw new Error("Invalid tenant")
  const redis = tenant === "A" ? "redis://127.0.0.1:6379" : "redis://127.0.0.1:6381"
  if (
    process.env.REDIS_URL !== redis ||
    (process.env.CACHE_REDIS_URL && process.env.CACHE_REDIS_URL !== redis) ||
    !process.env.DATABASE_URL?.endsWith("/f07d_" + tenant.toLowerCase())
  ) throw new Error("F07e requires isolated database and Redis per tenant")
  const dir = process.env.SHQIPSHOP_F07D_PROOF_DIR
  if (!dir || !process.env.RUNNER_TEMP || resolve(dir) !== resolve(process.env.RUNNER_TEMP)) {
    throw new Error("F07e proof must remain in GitHub runner temp")
  }
  const entity = args?.[0]
  const action = args?.[1]
  if ((entity !== "price" && entity !== "cart") ||
      (action !== "prime" && action !== "update" && action !== "verify")) {
    throw new Error("Invalid F07e operation")
  }
  const proofPath = join(dir, `f07e-${entity}-${tenant}.json`)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const cachedRow = async (id: string) => {
    const { data } = await query.graph(
      { entity, fields: entity === "price" ? ["id", "amount"] : ["id", "email"], filters: { id } },
      cacheConfig
    )
    assert.equal(data.length, 1, `Expected one ${entity} row`)
    return data[0] as { id: string; amount?: number; email?: string | null }
  }
  const readUncached = async (id: string) => {
    const { data } = await query.graph({
      entity, fields: entity === "price" ? ["id", "amount"] : ["id", "email"],
      filters: { id },
    })
    assert.equal(data.length, 1, "Expected one fresh DB row")
    return data[0] as { id: string; amount?: number; email?: string | null }
  }
  const field = entity === "price" ? "amount" : "email"
  const getField = (row: { amount?: number; email?: string | null }) =>
    entity === "price" ? row.amount : row.email ?? null

  if (action === "prime") {
    let proof: Proof
    if (entity === "price") {
      // Verify this is a live variant price, not an arbitrary pricing-table row.
      const { data: links } = await query.graph({
        entity: "product_variant_price_set", fields: ["variant_id", "price_set_id"],
      })
      const { data: variants } = await query.graph({
        entity: "product_variant", fields: ["id", "product_id"],
      })
      const { data: prices } = await query.graph({
        entity: "price", fields: ["id", "price_set_id", "currency_code", "amount"],
      })
      const selected = links.map((link) => {
        const variant = variants.find((v) => v.id === link.variant_id)
        const price = prices.find((p) =>
          p.price_set_id === link.price_set_id && p.currency_code === "all"
        )
        return variant && price ? { variant, price } : null
      }).find(Boolean)
      assert(selected?.variant?.id && selected.variant.product_id && selected.price?.id,
        "No linked ALL-currency variant price in disposable Medusa")
      const oldAmount = Number(selected.price.amount)
      assert(Number.isFinite(oldAmount) && oldAmount >= 0, "Invalid seeded price amount")
      proof = {
        tenant, id: String(selected.price.id), before: oldAmount,
        after: oldAmount + 7, productId: String(selected.variant.product_id),
        variantId: String(selected.variant.id),
      }
    } else {
      const { data: regions } = await query.graph({
        entity: "region", fields: ["id", "currency_code"],
      })
      const region = regions.find((r) => r.currency_code === "all")
      assert(region?.id, "Albanian region missing for F07e cart")
      const { result } = await createCartWorkflow(container).run({
        input: { region_id: String(region.id) },
      })
      assert(result?.id, "Medusa createCartWorkflow returned no cart")
      proof = {
        tenant, id: String(result.id), before: null,
        after: `f07e-${tenant.toLowerCase()}@example.invalid`,
      }
    }
    const baseline = await cachedRow(proof.id)
    assert.equal(getField(baseline), proof.before, "Cached baseline differs from seed")
    writeFileSync(proofPath, JSON.stringify(proof), { flag: "wx", mode: 0o600 })
    console.log(`SHQIPSHOP_F07E_${tenant}_${entity.toUpperCase()}_CACHE_PRIMED`)
    return
  }

  const proof = JSON.parse(readFileSync(proofPath, "utf8")) as Proof
  assert.equal(proof.tenant, tenant, "Foreign tenant proof rejected")
  if (action === "update") {
    if (entity === "price") {
      assert(proof.productId && proof.variantId, "Missing variant linkage")
      await upsertVariantPricesWorkflow(container).run({
        input: {
          variantPrices: [{
            product_id: proof.productId, variant_id: proof.variantId,
            prices: [{ id: proof.id, amount: Number(proof.after) }],
          }],
          previousVariantIds: [proof.variantId],
        },
      })
    } else {
      await updateCartWorkflow(container).run({
        input: { id: proof.id, email: String(proof.after) },
      })
    }
    const fresh = await readUncached(proof.id)
    assert.equal(getField(fresh), proof.after, "Real Medusa mutation did not persist")
    console.log(`SHQIPSHOP_F07E_${tenant}_${entity.toUpperCase()}_WORKFLOW_UPDATED`)
    return
  }

  let current = await cachedRow(proof.id)
  // Event delivery is async. A finite bound detects permanently stale responses.
  for (let i = 0; i < 30 && getField(current) !== proof.after; i++) {
    await new Promise((resolve) => setTimeout(resolve, 1000))
    current = await cachedRow(proof.id)
  }
  if (getField(current) !== proof.after) {
    const fresh = await readUncached(proof.id)
    console.error("SHQIPSHOP_F07E_STALE_CACHE_DIAGNOSTIC", JSON.stringify({
      entity, tenant, databaseUpdated: getField(fresh) === proof.after,
      cachedStillOld: getField(current) === proof.before,
    }))
  }
  assert.equal(getField(current), proof.after, `Stale ${entity} cache after mutation`)
  assert.notEqual(getField(current), proof.before, `Old ${entity} value still visible`)
  console.log(`SHQIPSHOP_F07E_${tenant}_${entity.toUpperCase()}_AUTO_INVALIDATION_PASSED`)
}
