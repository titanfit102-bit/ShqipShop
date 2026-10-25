/**
 * F07g Stage 2B-1: read-only proof against a REAL disposable Medusa cart
 * and linked catalogue ALL-currency price rows.
 *
 * Not an HTTP quote endpoint, security authorization, persistence migration,
 * live payment or Medusa cart-completion hook. A real buyer/capability proof,
 * pricing-rule engine, tax/discount/shipping recalculation, and atomic checkout
 * workflow are NOT implemented here. Never enable in Production.
 */
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  acceptCheckoutQuote, assertAcceptedCheckoutQuote, fingerprintQuoteSnapshot,
  issueCheckoutQuote, type CheckoutQuote, type QuoteSnapshot,
} from "../lib/checkout/quote-contract"

const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex")
const fail = (reason: string): never => { throw new Error("F07g Medusa cart proof: " + reason) }
const money = (x: unknown) => {
  // Medusa Query Graph returns stored prices as numbers, but computed cart
  // totals and unit_price as BigNumber instances. Preserve decimal text;
  // never JSON-coerce/round those objects to an unsafe JavaScript float.
  if (x === null || x === undefined) return fail("missing financial field")
  const s = String(x)
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(s)) return fail("invalid financial field")
  return s
}
const identifier = (value: unknown, prefix: string) => {
  if (typeof value !== "string" || !value.startsWith(prefix) ||
    !/^[a-zA-Z0-9_-]{8,}$/.test(value)) return fail("invalid ID")
  return value
}

export default async function liveCart({ container, args }: ExecArgs) {
  const required: Record<string, string> = {
    CI: "true", NODE_ENV: "development",
    SHQIPSHOP_REQUIRE_REDIS: "true", SHQIPSHOP_F07E_REPRICE_PROBE: "true",
    SHQIPSHOP_F07G_REAL_CART_CI: "true",
    DATABASE_URL: "postgres://medusa_ci:disposable_ci_password@127.0.0.1:5432/medusa_ci",
    REDIS_URL: "redis://127.0.0.1:6379",
  }
  for (const [name, expected] of Object.entries(required)) assert.equal(process.env[name], expected)
  const phase = args?.[0]
  assert(phase === "before" || phase === "after", "Expected before/after price mutation")
  const temp = process.env.RUNNER_TEMP
  const proof = process.env.SHQIPSHOP_F07E_REPRICE_PROOF_FILE
  const checkpoint = process.env.SHQIPSHOP_F07G_REAL_CART_PROOF_FILE
  assert(temp && proof && checkpoint, "Runner-only proof paths required")
  for (const p of [proof, checkpoint]) {
    assert(resolve(p).startsWith(resolve(temp) + "/"), "Proof must remain inside runner temp")
  }
  const prepared = JSON.parse(readFileSync(proof, "utf8")) as {
    cartId: string; variantId: string; originalAmount: number; expectedAmount: number
  }
  const cartId = identifier(prepared.cartId, "cart_")
  const variantId = identifier(prepared.variantId, "variant_")
  assert(Number.isSafeInteger(prepared.originalAmount) && prepared.originalAmount > 0)
  assert.equal(prepared.expectedAmount, prepared.originalAmount + 17)

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  // All data is retrieved by server-side QUERY; never use a client-supplied
  // total or tenant/buyer claim. Stage-2B-1 is intentionally an ALL-only,
  // no-discounts, no-shipping-price-rule proof for ONE actual Medusa line item.
  const [{ data: carts }, { data: links }, { data: prices }] = await Promise.all([
    query.graph({
      entity: "cart",
      fields: [
        "id", "currency_code", "region_id", "updated_at", "total",
        "tax_total", "discount_total", "credit_line_total",
        "items.id", "items.variant_id", "items.quantity", "items.unit_price", "items.total",
      ],
      filters: { id: cartId },
    }),
    query.graph({
      entity: "product_variant_price_set", fields: ["variant_id", "price_set_id"],
      filters: { variant_id: variantId },
    }),
    query.graph({ entity: "price",
      fields: ["id", "price_set_id", "currency_code", "amount", "updated_at"] }),
  ])
  assert.equal(carts.length, 1, "Expected exactly one real Medusa cart")
  const cart = carts[0]
  assert.equal(cart.id, cartId)
  assert.equal(cart.currency_code, "all")
  assert(Array.isArray(cart.items) && cart.items.length === 1,
    "This CI proof supports one line item only")
  const item = cart.items[0]
  assert.equal(item.variant_id, variantId)
  const lineId = identifier(item.id, "cali_")
  assert(Number.isSafeInteger(Number(item.quantity)) && Number(item.quantity) === 1,
    "CI proof cart must remain one unit")
  const matchingSets = new Set(links.map(row => String(row.price_set_id)))
  assert.equal(matchingSets.size, 1, "Only one variant price set accepted")
  const linked = prices.filter(row =>
    matchingSets.has(String(row.price_set_id)) && row.currency_code === "all")
  assert.equal(linked.length, 1, "Only one linked ALL price accepted")
  const price = linked[0]
  const effectivePrice = money(price.amount)
  const cartUnit = money(item.unit_price)
  const cartTotal = money(cart.total)
  const lineTotal = money(item.total)
  const taxTotal = money(cart.tax_total ?? 0)
  const discountTotal = money(cart.discount_total ?? 0)
  const creditTotal = money(cart.credit_line_total ?? 0)

  const snapshot: QuoteSnapshot = {
    tenantId: "merchant_ci_isolated",
    cartId, buyerBinding: "guest:sha256:" + digest(["ci-test-only",cartId]),
    cartRevision: "cart_" + digest([
      cartId, cart.region_id, cart.updated_at,
      [lineId, variantId, item.quantity, cartUnit, lineTotal],
      cartTotal, taxTotal, discountTotal, creditTotal,
    ]),
    pricingRevision: "price_" + digest([
      String(price.id), String(price.price_set_id), effectivePrice, price.updated_at,
    ]),
    currency: "all", total: cartTotal,
    items: [{
      lineId, variantId, quantity: Number(item.quantity),
      unitAmount: cartUnit, lineTotal,
    }],
    shipping: [], adjustments: [], taxTotal, discountTotal, creditTotal,
  }

  if (phase === "before") {
    // Fail closed if the real Store cart price already disagrees with its
    // only linked ALL price, or cart arithmetic is inconsistent.
    assert.equal(cartUnit, effectivePrice, "Unrefreshed cart cannot be newly confirmed")
    assert.equal(Number(lineTotal), Number(cartUnit), "CI line amount inconsistent")
    assert.equal(Number(cartTotal), Number(lineTotal) + Number(taxTotal) - Number(discountTotal),
      "CI total must come from coherent Medusa data")
    const now = Date.now()
    const quote = issueCheckoutQuote(snapshot, now, 300000)
    const accepted = acceptCheckoutQuote(quote,
      { quoteId: quote.id, fingerprint: quote.fingerprint }, snapshot, now + 1)
    assertAcceptedCheckoutQuote(accepted, snapshot, now + 2)
    writeFileSync(checkpoint, JSON.stringify({ accepted, linkedAmount: effectivePrice }),
      { flag: "wx", mode: 0o600 })
    console.log("SHQIPSHOP_F07G_REAL_MEDUSA_CART_SNAPSHOT_BEFORE_REPRICE_PASSED")
    return
  }

  const prior = JSON.parse(readFileSync(checkpoint, "utf8")) as {
    accepted: CheckoutQuote; linkedAmount: string
  }
  assert.equal(Number(effectivePrice), prepared.expectedAmount,
    "Catalogue repricing did not persist in real Medusa PostgreSQL")
  assert.equal(Number(prior.linkedAmount), prepared.originalAmount)
  assert.notEqual(snapshot.pricingRevision, prior.accepted.snapshot.pricingRevision,
    "Catalogue price revision must change even when an active cart stays stale")
  assert.notEqual(fingerprintQuoteSnapshot(snapshot), prior.accepted.fingerprint,
    "Old acceptance must never be reusable after catalogue repricing")
  assert.throws(() => assertAcceptedCheckoutQuote(prior.accepted, snapshot,
    prior.accepted.acceptedAtMs! + 2), /F07g checkout quote conflict/)
  if (cartUnit !== effectivePrice) {
    console.log("SHQIPSHOP_F07G_REAL_MEDUSA_STALE_CART_UNIT_OBSERVED_NOT_APPROVED")
  } else {
    console.log("SHQIPSHOP_F07G_REAL_MEDUSA_CART_ALREADY_REPRICED_OBSERVED")
  }
  console.log("SHQIPSHOP_F07G_REAL_MEDUSA_REPRICE_INVALIDATES_BUYER_QUOTE_PASSED")
}
