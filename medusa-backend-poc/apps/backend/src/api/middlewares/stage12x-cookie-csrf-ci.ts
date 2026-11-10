/**
 * Stage 12X: experimental, strictly disposable Medusa 2.22.6 CI-only
 * cookie-mutation origin gate. NOT a production CSRF policy. This guards
 * only the two tested customer/Admin profile mutations AND the selected
 * Stage12AE POST /admin/products/:id mutation on the disposable AOF instance.
 * This is not a production fix, per-session CSRF token, or global route policy.
 */
import type { MedusaRequest, MedusaResponse, MedusaNextFunction } from "@medusajs/framework/http"

const scoped = (): boolean =>
  process.env.CI === "true" &&
  process.env.NODE_ENV === "development" &&
  process.env.SHQIPSHOP_MEDUSA_CANDIDATE_CI === "true" &&
  process.env.SHQIPSHOP_REQUIRE_REDIS === "true" &&
  /^[0-9]+$/.test(process.env.GITHUB_RUN_ID ?? "") &&
  /^redis:\/\/127\.0\.0\.1:6382$/.test(process.env.REDIS_URL ?? "")

function origins(value: string | undefined): Set<string> {
  const result = new Set<string>()
  for (const raw of (value ?? "").split(",")) {
    const item = raw.trim()
    if (!item || item === "*" || item === "null") continue
    try {
      const u = new URL(item)
      if ((u.protocol === "http:" || u.protocol === "https:") &&
          u.origin === item && !u.username && !u.password) result.add(item)
    } catch { /* invalid allowlist entry stays denied */ }
  }
  return result
}

function reject(res: MedusaResponse, reason: string) {
  // Avoid logging cookies, authenticated user IDs, or payloads.
  console.log("SHQIPSHOP_STAGE12X_CI_CSRF_DENIED_" + reason)
  return res.sendStatus(403)
}

export function enforceStage12xCookieCsrfCi(
  req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction
) {
  if (!scoped()) return next()
  if (!["POST","PUT","PATCH","DELETE"].includes(req.method)) return next()
  // Only cookie-authenticated requests need this additional guard; the
  // built-in Medusa identity/role authorization still runs independently.
  const cookie=req.headers.cookie
  if (typeof cookie !== "string" ||
      !/(?:^|;\s*)connect\.sid=/.test(cookie)) return next()
  const route = req.originalUrl?.split("?")[0] ?? req.path
  const isCustomer = route === "/store/customers/me" || route === "/store/customers/me/"
  const isAdmin = /^\/admin\/customers\/[^/]+\/?$/.test(route)
  const isAdminProductPost = req.method === "POST" &&
    /^\/admin\/products\/[^/]+\/?$/.test(route)
  if (!isCustomer && !isAdmin && !isAdminProductPost) return next()

  const expected = origins(isCustomer ? process.env.STORE_CORS : process.env.ADMIN_CORS)
  const origin = req.headers.origin
  if (typeof origin !== "string" || !expected.has(origin))
    return reject(res,"ORIGIN")
  const metadata=req.headers["sec-fetch-site"]
  if (typeof metadata === "string" && !["same-origin","same-site","none"].includes(metadata))
    return reject(res,"FETCH_METADATA")
  if (typeof metadata !== "undefined" && typeof metadata !== "string")
    return reject(res,"FETCH_METADATA")
  const referer=req.headers.referer
  if (referer !== undefined) {
    try {
      if (typeof referer !== "string" || new URL(referer).origin !== origin)
        return reject(res,"REFERER")
    } catch { return reject(res,"REFERER") }
  }
  // Browser-simple POST form encodings must not reach these JSON mutations.
  const contentType=req.headers["content-type"]
  if (typeof contentType !== "string" ||
      !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(contentType))
    return reject(res,"CONTENT_TYPE")
  return next()
}
