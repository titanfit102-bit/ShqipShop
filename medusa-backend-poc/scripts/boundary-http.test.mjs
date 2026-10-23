import test from "node:test"
import assert from "node:assert/strict"
import { createServer } from "node:http"
import { request, isDenied, unchanged } from "./boundary-http.mjs"

test("auth rejection gate fails closed on validation errors, missing routes and server failures", () => {
  for (const status of [401, 403]) isDenied({status}, "synthetic probe")
  for (const status of [200, 201, 302, 400, 404, 500]) {
    assert.throws(() => isDenied({status}, "synthetic probe"))
  }
})

test("side effect gate detects nested changes without exposing response contents", () => {
  unchanged({metadata:{label:"before"}}, {metadata:{label:"before"}}, "snapshot")
  assert.throws(() => unchanged({metadata:{label:"sensitive-value"}}, {metadata:{label:"before"}}, "snapshot"),
    err => !err.message.includes("sensitive-value"))
})

test("real HTTP preserves cookie signatures and does not silently carry bearer auth", async () => {
  const server = createServer((req, res) => {
    if (req.url === "/session") {
      res.setHeader("Set-Cookie", ["connect.sid=s%3Aone.signature; Path=/; HttpOnly", "other=two; Path=/"])
      res.end(JSON.stringify({ok:true}))
    } else if (req.url === "/redirect") {
      res.writeHead(302, {location:"http://example.invalid/forbidden"})
      res.end()
    } else {
      res.end(JSON.stringify({cookie:req.headers.cookie, authorization:req.headers.authorization ?? null,
        key:req.headers["x-publishable-api-key"], customer:req.headers["x-customer-id"]}))
    }
  })
  await new Promise(resolve => server.listen(9000, "127.0.0.1", resolve))
  try {
    const merchant = {base:"http://127.0.0.1:9000", key:"synthetic-key"}
    const session = await request(merchant, "POST", "/session", {token:"synthetic-token"})
    assert.equal(session.cookie, "connect.sid=s%3Aone.signature; other=two")
    const profile = await request(merchant, "GET", "/profile", {cookie:session.cookie, key:true,
      headers:{"x-customer-id":"synthetic-foreign-id"}})
    assert.equal(profile.data.cookie, "connect.sid=s%3Aone.signature; other=two")
    assert.equal(profile.data.authorization, null)
    assert.equal(profile.data.key, "synthetic-key")
    assert.equal(profile.data.customer, "synthetic-foreign-id")
    assert.equal((await request(merchant, "GET", "/redirect")).status, 302)
    await assert.rejects(request({...merchant,base:"https://example.invalid"}, "GET", "/profile"))
    await assert.rejects(request(merchant, "GET", "//example.invalid/profile"))
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
})
