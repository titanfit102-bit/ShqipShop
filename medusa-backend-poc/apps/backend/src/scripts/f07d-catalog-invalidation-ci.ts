/** F07d incremental CI: confirm Query's automatic Redis cache invalidation
 * after updating a real, seeded Medusa product via its official workflow.
 * All data lives in disposable CI databases. No manual cache.clear() here.
 */
import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import { readFileSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"
import assert from "node:assert/strict"

type Proof = { id: string; before: string; after: string; tenant: "A" | "B" }

export default async function catalogInvalidationProof({ container, args }: ExecArgs) {
  if (
    process.env.CI !== "true" ||
    process.env.NODE_ENV !== "development" ||
    process.env.SHQIPSHOP_F07D_PROBE !== "true" ||
    process.env.SHQIPSHOP_REQUIRE_REDIS !== "true" ||
    process.env.MEDUSA_FF_CACHING !== "true" ||
    process.env.WORKER_MODE !== "server"
  ) throw new Error("F07d catalog invalidation is restricted to disposable CI")

  const tenant = process.env.SHQIPSHOP_F07D_TENANT
  if (tenant !== "A" && tenant !== "B") throw new Error("Missing CI tenant A/B")
  const redis = tenant === "A" ? "redis://127.0.0.1:6379" : "redis://127.0.0.1:6381"
  if (process.env.REDIS_URL !== redis ||
      (process.env.CACHE_REDIS_URL && process.env.CACHE_REDIS_URL !== redis) ||
      !process.env.DATABASE_URL?.endsWith("/f07d_" + tenant.toLowerCase())) {
    throw new Error("F07d invalidation tenant resources are not isolated")
  }
  const dir = process.env.SHQIPSHOP_F07D_PROOF_DIR
  if (!dir || !process.env.RUNNER_TEMP || resolve(dir) !== resolve(process.env.RUNNER_TEMP)) {
    throw new Error("F07d proof file must reside in RUNNER_TEMP")
  }
  const proofFile = join(dir, "f07d-catalog-" + tenant + ".json")
  const action = args?.[0]
  if (action !== "prime" && action !== "update" && action !== "verify") {
    throw new Error("Invalid F07d catalog probe action")
  }
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const cachedProduct = async (id: string) => {
    const { data } = await query.graph({
      entity: "product",
      fields: ["id", "title"],
      filters: { id },
    }, { cache: { enable: true, ttl: 900 } })
    assert.equal(data.length, 1, "Expected exactly one Medusa product")
    return data[0]
  }

  if (action === "prime") {
    const { data } = await query.graph({ entity: "product", fields: ["id", "title"] })
    assert(data.length > 0, "Disposable Medusa database has no seeded products")
    const first = [...data].sort((a, b) => String(a.id).localeCompare(String(b.id)))[0]
    assert(first.id && typeof first.title === "string", "Invalid test product")
    const after = "F07d updated product " + tenant
    assert.notEqual(first.title, after, "Product already modified")
    const value = await cachedProduct(String(first.id))
    assert.equal(value.title, first.title, "Cached baseline differs from database")
    const proof: Proof = { id: String(first.id), before: first.title, after, tenant }
    writeFileSync(proofFile, JSON.stringify(proof), { flag: "wx", mode: 0o600, encoding: "utf8" })
    console.log("SHQIPSHOP_F07D_" + tenant + "_PRODUCT_QUERY_CACHE_PRIMED")
    return
  }

  const proof = JSON.parse(readFileSync(proofFile, "utf8")) as Proof
  assert.equal(proof.tenant, tenant, "Proof file belongs to another merchant")
  if (action === "update") {
    await updateProductsWorkflow(container).run({
      input: { selector: { id: proof.id }, update: { title: proof.after } },
    })
    const { data } = await query.graph({
      entity: "product", fields: ["id", "title"], filters: { id: proof.id },
    })
    assert.equal(data[0]?.title, proof.after, "Medusa DB mutation was not persisted")
    console.log("SHQIPSHOP_F07D_" + tenant + "_PRODUCT_WORKFLOW_UPDATED")
    return
  }
  let value = await cachedProduct(proof.id)
  // Invalidations are dispatched via the Redis event bus. Dedicated workers
  // may process them shortly after the mutation commits: bound the freshness SLA.
  for (let attempt = 0; attempt < 30 && value.title !== proof.after; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 1000))
    value = await cachedProduct(proof.id)
  }
  if (value.title !== proof.after) {
    const { data: uncached } = await query.graph({
      entity: "product", fields: ["id", "title"], filters: { id: proof.id },
    })
    console.error("F07D_CACHE_INVALIDATION_DIAGNOSTIC", JSON.stringify({
      tenant, cachedStillOld: value.title === proof.before,
      databaseUpdated: uncached[0]?.title === proof.after,
    }))
  }
  assert.equal(value.title, proof.after, "STALE PRODUCT CACHE after Medusa update workflow")
  assert.notEqual(value.title, proof.before, "Product cache still contains old title")
  console.log("SHQIPSHOP_F07D_" + tenant + "_PRODUCT_AUTO_INVALIDATION_PASSED")
}
