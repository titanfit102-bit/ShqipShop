/**
 * HTTP-only F07g Medusa guest/auth boundary probe. CI local disposable cart.
 * No quote is issued/accepted. No private secrets ever printed.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const env = {
  CI: "true", NODE_ENV: "development",
  SHQIPSHOP_REQUIRE_REDIS: "true", SHQIPSHOP_F07G_HTTP_CI: "true",
  DATABASE_URL: "postgres://medusa_ci:disposable_ci_password@127.0.0.1:5432/medusa_ci",
  REDIS_URL: "redis://127.0.0.1:6379",
}
for (const [name, expected] of Object.entries(env)) assert.equal(process.env[name], expected)
const tmp = process.env.RUNNER_TEMP
const proofFile = process.env.SHQIPSHOP_F07E_REPRICE_PROOF_FILE
const apiKeyFile = process.env.SHQIPSHOP_CI_PUBLISHABLE_KEY_FILE
assert(tmp && proofFile && apiKeyFile)
for (const path of [proofFile, apiKeyFile]) {
  assert(resolve(path).startsWith(resolve(tmp) + "/"), "Runner-local CI only")
}
const { cartId } = JSON.parse(readFileSync(proofFile, "utf8"))
assert(typeof cartId === "string" && /^cart_[A-Za-z0-9_-]{8,}$/.test(cartId))
const key = readFileSync(apiKeyFile, "utf8").trim()
assert(key.length > 10, "Ephemeral publishable key required")
const url = "http://127.0.0.1:9000/store/shqipshop/quote-boundary-ci"

async function check(headers = {}, body) {
  const result = await fetch(url, {
    method: "POST",
    headers: {
      "x-publishable-api-key": key,
      "x-shqipshop-cart-id": cartId,
      ...headers,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  })
  let bodyJson = null
  if (result.status === 200) bodyJson = await result.json()
  return { status: result.status, body: bodyJson }
}
const positive = await check({ "x-shqipshop-cart-proof": cartId })
assert.equal(positive.status, 200, "Valid owned guest cart must pass HTTP boundary")
assert.equal(positive.body?.kind, "guest")
assert.match(positive.body?.scope_fingerprint ?? "", /^[0-9a-f]{64}$/)
assert(!JSON.stringify(positive.body).includes(cartId), "Never return raw capability")
const repeat = await check({ "x-shqipshop-cart-proof": cartId })
assert.equal(repeat.status, 200)
assert.equal(repeat.body?.scope_fingerprint, positive.body.scope_fingerprint)

for (const [name, headers, body] of [
  ["missing-proof", {}, null],
  ["foreign-proof", { "x-shqipshop-cart-proof": "cart_foreign_test_12345678" }, null],
  ["absent-cart", { "x-shqipshop-cart-proof": cartId, "x-shqipshop-cart-id": "cart_not_here_12345678" }, null],
  ["spoof-merchant-header", { "x-shqipshop-cart-proof": cartId, "x-shqipshop-tenant-id": "merchant_foreign" }, null],
  ["spoof-merchant-body", { "x-shqipshop-cart-proof": cartId }, { merchant_id: "merchant_foreign" }],
  ["forged-bearer", { "x-shqipshop-cart-proof": cartId, authorization: "Bearer invalid_ci_token" }, null],
  ["invalid-session-cookie", { "x-shqipshop-cart-proof": cartId, cookie: "connect.sid=s%3Afake-ci-session.signature" }, null],
]) {
  const result = await check(headers, body)
  assert([400, 401, 403, 404].includes(result.status),
    `F07g denied case ${name} unexpectedly got HTTP ${result.status}`)
}
console.log("SHQIPSHOP_F07G_REAL_HTTP_GUEST_CAPABILITY_AND_TENANT_SPOOF_DENIED")
console.log("SHQIPSHOP_F07G_REAL_HTTP_INVALID_AUTH_NO_GUEST_DOWNGRADE")
