/** CI-only: session minted in merchant A's process :9000 must authenticate
 * in an independent Medusa process :9002 using A's SAME Redis/DB/secrets.
 * Merchant B's independent cookie must fail. No credential is logged.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve, sep } from "node:path"

assert.equal(process.env.CI, "true")
assert.equal(process.env.NODE_ENV, "development")
const proofPath = process.env.SHQIPSHOP_CI_SESSION_PROOF_FILE
const runnerTemp = process.env.RUNNER_TEMP
assert(proofPath && runnerTemp, "Missing ephemeral session handoff file")
assert(resolve(proofPath).startsWith(resolve(runnerTemp) + sep), "Only runner temp credentials allowed")
const proof = JSON.parse(readFileSync(proofPath, "utf8"))
assert(proof.A?.customer?.cookie?.includes("connect.sid="))
assert(proof.A?.admin?.cookie?.includes("connect.sid="))
assert(proof.B?.customer?.cookie?.includes("connect.sid="))
assert(proof.B?.admin?.cookie?.includes("connect.sid="))

const base = "http://127.0.0.1:9002"
async function get(path, cookie, key) {
  const response = await fetch(base + path, {
    method: "GET",
    redirect: "manual",
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(key ? { "x-publishable-api-key": key } : {}),
    },
    signal: AbortSignal.timeout(20000),
  })
  const raw = await response.text()
  let body = {}
  try { body = raw ? JSON.parse(raw) : {} } catch {}
  return { status: response.status, body }
}
const profiles = [
  { actor: "customer", path: "/store/customers/me", field: "customer", key: proof.A.key },
  { actor: "admin", path: "/admin/users/me", field: "user", key: undefined },
]
for (const p of profiles) {
  const own = await get(p.path, proof.A[p.actor].cookie, p.key)
  assert.equal(own.status, 200, "A cookie rejected by independent Medusa process")
  assert.equal(own.body[p.field]?.id, proof.A[p.actor].id, "Wrong A identity in other process")

  const stranger = await get(p.path, proof.B[p.actor].cookie, p.key)
  assert([401,403].includes(stranger.status), "Merchant B cookie accepted by merchant A process")

  const anonymous = await get(p.path, undefined, p.key)
  assert([401,403].includes(anonymous.status), "Anonymous session accepted in second process")
}
console.log("SHQIPSHOP_REDIS_SAME_MERCHANT_COOKIE_CROSS_PROCESS_PASSED")
console.log("LIMIT: independent process cookie reuse does not prove restart after Redis outage or HA")
