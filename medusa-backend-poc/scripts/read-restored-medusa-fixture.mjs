import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const [orderId, cartId, imageFile] = process.argv.slice(2)
assert(/^order_[A-Za-z0-9]+$/.test(orderId))
assert(/^cart_[A-Za-z0-9]+$/.test(cartId))
const key = readFileSync(process.env.SHQIPSHOP_CI_PUBLISHABLE_KEY_FILE, "utf8")
const origin = "http://127.0.0.1:9000"
const photo = origin + "/static/medusa-restore-fixture.png"
const headers = { "x-publishable-api-key": key }

const products = await fetch(origin + "/store/products", { headers, signal: AbortSignal.timeout(10000) })
assert.equal(products.status, 200)
const product = (await products.json()).products.find(item => item.title === "Medusa Shorts")
assert(product?.images?.some(image => image.url === photo), "Missing restored image reference")
const image = await fetch(photo, { signal: AbortSignal.timeout(10000) })
assert.equal(image.status, 200)
assert(Buffer.from(await image.arrayBuffer()).equals(readFileSync(imageFile)), "Restored image bytes changed")

const path = origin + "/store/orders/" + encodeURIComponent(orderId)
const unauthenticated = await fetch(path, { headers, signal: AbortSignal.timeout(10000) })
assert([401, 403, 404].includes(unauthenticated.status))
const receipt = await fetch(path, {
  headers: { ...headers, "x-shqipshop-cart-proof": cartId }, signal: AbortSignal.timeout(10000),
})
assert.equal(receipt.status, 200)
const { order } = await receipt.json()
assert.deepEqual([order.id, order.currency_code, order.total], [orderId, "all", 1510])
console.log("SHQIPSHOP_RESTORED_MEDUSA_RECEIPT_CATALOG_AND_IMAGE_VERIFIED")
