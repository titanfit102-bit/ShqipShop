/** F07d: synthetic Redis cache proof using real Medusa Caching Module.
 * Runs only in disposable CI databases and physically distinct tenant Redis.
 * No customer data, orders, prices, or production services are touched.
 */
import type { ExecArgs, ICachingModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import assert from "node:assert/strict"

const KEY = "shqipshop:f07d:synthetic:shared-key"
const TAG = "shqipshop:f07d:synthetic:invalidation"

export default async function f07dCacheProof({ container, args }: ExecArgs) {
  if (
    process.env.CI !== "true" ||
    process.env.NODE_ENV !== "development" ||
    process.env.SHQIPSHOP_REQUIRE_REDIS !== "true" ||
    process.env.MEDUSA_FF_CACHING !== "true" ||
    process.env.SHQIPSHOP_F07D_PROBE !== "true" ||
    process.env.WORKER_MODE !== "server"
  ) throw new Error("F07d requires disposable CI mode with Redis caching enabled")

  const tenant = process.env.SHQIPSHOP_F07D_TENANT
  if (tenant !== "A" && tenant !== "B") throw new Error("Invalid F07d tenant")
  const expected = tenant === "A" ? "redis://127.0.0.1:6379" : "redis://127.0.0.1:6381"
  if (process.env.REDIS_URL !== expected ||
      (process.env.CACHE_REDIS_URL && process.env.CACHE_REDIS_URL !== expected)) {
    throw new Error("F07d tenant Redis is not physically isolated")
  }
  const action = args?.[0]
  if (!["write", "read", "miss", "clear"].includes(String(action))) {
    throw new Error("Invalid F07d operation")
  }

  const caching = container.resolve<ICachingModuleService>(Modules.CACHING)
  if (action === "write") {
    await caching.set({ key: KEY, tags: [TAG], data: { tenant, proof: "f07d" }, ttl: 120 })
    const readBack = await caching.get({ key: KEY })
    assert.deepEqual(readBack, { tenant, proof: "f07d" }, "Cache write not durable within process")
  } else if (action === "read") {
    const result = await caching.get({ key: KEY })
    assert.deepEqual(result, { tenant, proof: "f07d" }, "Same-tenant cross-process cache miss or leakage")
  } else if (action === "miss") {
    const result = await caching.get({ key: KEY })
    assert.equal(result, null, "Foreign-tenant cache was visible or invalidation failed")
  } else if (action === "clear") {
    await caching.clear({ key: KEY })
    const result = await caching.get({ key: KEY })
    assert.equal(result, null, "Cache key survived clear")
  }
  console.log(`SHQIPSHOP_F07D_CACHE_${tenant}_${String(action).toUpperCase()}_PASSED`)
}
