/** CI test transport. Never logs response objects, cookies or credentials. */
import assert from "node:assert/strict"
import { isDeepStrictEqual } from "node:util"

export const isDenied = (res, context) =>
  assert([401,403].includes(res.status), context + ": expected HTTP 401/403, got " + res.status)

export const unchanged = (actual, expected, context) =>
  assert(isDeepStrictEqual(actual, expected), context + ": unexpected side effect")

export async function request(m, method, path, {token, key, body, cookie, headers={}}={}) {
  assert(["http://127.0.0.1:9000", "http://127.0.0.1:9001"].includes(m.base), "CI localhost only")
  assert(path.startsWith("/") && !path.startsWith("//"), "Relative API path required")
  const response = await fetch(m.base + path, {
    method,
    redirect: "manual",
    headers: {
      ...headers,
      ...(key ? {"x-publishable-api-key": m.key} : {}),
      ...(token ? {authorization:"Bearer " + token} : {}),
      ...(cookie ? {cookie} : {}),
      ...(body !== undefined ? {"content-type":"application/json"} : {}),
    },
    ...(body !== undefined ? {body:JSON.stringify(body)} : {}),
    signal: AbortSignal.timeout(20000),
  })
  const raw = await response.text()
  let data = {}
  try { data = raw ? JSON.parse(raw) : {} } catch { /* caller checks status and required fields */ }
  const setCookies = response.headers.getSetCookie()
  return {status:response.status, data, setCookies,
    cookie:setCookies.map(line => line.split(";", 1)[0]).join("; ")}
}
