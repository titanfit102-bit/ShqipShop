import assert from "node:assert/strict"
import type { ExecArgs } from "@medusajs/framework/types"
import {
  acceptCheckoutQuote,
  assertAcceptedCheckoutQuote,
  canonicalQuoteSnapshot,
  fingerprintQuoteSnapshot,
  issueCheckoutQuote,
  type QuoteSnapshot,
} from "../lib/checkout/quote-contract"

/**
 * F07g Stage-1 contract-only proof; NOT an API, migration, buyer UI or
 * concurrent payment-order lock. Uses 100% synthetic, disposable CI fixtures.
 */
export default async function prove(_args: ExecArgs) {
  const env = {
    CI: "true",
    NODE_ENV: "development",
    SHQIPSHOP_REQUIRE_REDIS: "true",
    SHQIPSHOP_F07G_CONTRACT_CI: "true",
    DATABASE_URL: "postgres://medusa_ci:disposable_ci_password@127.0.0.1:5432/medusa_ci",
    REDIS_URL: "redis://127.0.0.1:6379",
  }
  for (const [name, expected] of Object.entries(env)) {
    assert.equal(process.env[name], expected, name)
  }

  const clock = 1793000000000
  const cart: QuoteSnapshot = {
    tenantId: "merchant_A",
    cartId: "cart_synthetic_a",
    buyerBinding: "guest:sha256:" + "a".repeat(64),
    cartRevision: "v3",
    pricingRevision: "catalog_v11",
    currency: "all",
    total: "3044",
    items: [
      { lineId: "line_2", variantId: "variant_sock", quantity: 1,
        unitAmount: "500.00", lineTotal: "500" },
      { lineId: "line_1", variantId: "variant_short", quantity: 2,
        unitAmount: "1250", lineTotal: "2500" },
    ],
    shipping: [{ id: "ship_1", amount: "10" }],
    adjustments: [{ id: "promo_1", amount: "0" }],
    taxTotal: "34",
    discountTotal: "0",
    creditTotal: "0",
  }
  const changed = (fields: Partial<QuoteSnapshot>) => ({ ...cart, ...fields })
  const bad = /F07g checkout quote conflict/

  const quote = issueCheckoutQuote(cart, clock, 120000)
  assert.equal(quote.status, "quoted")
  assert.notEqual(quote.id, issueCheckoutQuote(cart, clock, 120000).id)
  assert.doesNotThrow(() => canonicalQuoteSnapshot(cart))
  assert.equal(fingerprintQuoteSnapshot(cart), fingerprintQuoteSnapshot({
    ...cart,
    total: "3044.00",
    shipping: [{ id: "ship_1", amount: "10.00" }],
    items: [...cart.items].reverse(),
  }))
  assert.throws(() => assertAcceptedCheckoutQuote(quote, cart, clock), bad)
  assert.throws(() => acceptCheckoutQuote(quote,
    { quoteId: "quote_wrong", fingerprint: quote.fingerprint }, cart, clock), bad)
  assert.throws(() => acceptCheckoutQuote(quote,
    { quoteId: quote.id, fingerprint: "client_forgery" }, cart, clock), bad)

  const accepted = acceptCheckoutQuote(quote,
    { quoteId: quote.id, fingerprint: quote.fingerprint }, cart, clock + 10)
  assert.equal(accepted.status, "accepted")
  assert(accepted.acceptanceNonce)
  assert.doesNotThrow(() => assertAcceptedCheckoutQuote(accepted, cart, clock + 50))
  assert.throws(() => acceptCheckoutQuote(accepted,
    { quoteId: accepted.id, fingerprint: accepted.fingerprint }, cart, clock + 20), bad)
  assert.throws(() => assertAcceptedCheckoutQuote(accepted, cart, clock + 120000), bad)
  assert.throws(() => assertAcceptedCheckoutQuote(accepted, cart, clock - 1), bad)
  console.log("SHQIPSHOP_F07G_EXPLICIT_QUOTE_ACCEPTANCE_CONTRACT_PASSED")

  const changedScenarios: Array<[string, QuoteSnapshot]> = [
    ["tenant", changed({ tenantId: "merchant_B" })],
    ["cart", changed({ cartId: "cart_other" })],
    ["guest-capability", changed({ buyerBinding: "guest:sha256:" + "b".repeat(64) })],
    ["customer-vs-guest", changed({ buyerBinding: "customer:cus_foreign" })],
    ["currency", changed({ currency: "eur" })],
    ["reprice", changed({ total: "3061" })],
    ["changed-catalog-price-version", changed({ pricingRevision: "catalog_v12" })],
    ["changed-cart-revision", changed({ cartRevision: "v4" })],
    ["changed-quantity-but-same-total", changed({ items: [
      { ...cart.items[0], quantity: 2 }, cart.items[1],
    ] })],
    ["changed-variant-but-same-total", changed({ items: [
      { ...cart.items[0], variantId: "variant_other" }, cart.items[1],
    ] })],
    ["changed-item-unit-price", changed({ items: [
      { ...cart.items[0], unitAmount: "501" }, cart.items[1],
    ] })],
    ["shipping", changed({ shipping: [{ id: "ship_1", amount: "11" }] })],
    ["shipping-selection", changed({ shipping: [{ id: "ship_new", amount: "10" }] })],
    ["tax", changed({ taxTotal: "35" })],
    ["discount", changed({ discountTotal: "1" })],
    ["credit", changed({ creditTotal: "2" })],
    ["promotion", changed({ adjustments: [{ id: "promo_2", amount: "0" }] })],
  ]
  for (const [scenario, fresh] of changedScenarios) {
    assert.throws(() => assertAcceptedCheckoutQuote(accepted, fresh, clock + 50),
      bad, scenario)
  }
  console.log("SHQIPSHOP_F07G_STALE_PRINCIPAL_TENANT_PRICE_SHIPPING_CART_DENIED")

  for (const mutated of [
    changed({ total: "3e3" }),
    changed({ total: "-1" }),
    changed({ total: "NaN" }),
    changed({ total: "3044.1234567" }),
    changed({ currency: "ALL" }),
    changed({ items: [] }),
    changed({ items: [cart.items[0], cart.items[0]] }),
    changed({ shipping: [{ id: "ship_1", amount: "10" },
      { id: "ship_1", amount: "10" }] }),
    changed({ buyerBinding: "guest:raw-cart-token" }),
    changed({ buyerBinding: "customer:hello@example.com" }),
    changed({ items: [{ ...cart.items[0], quantity: 0 }] }),
  ]) {
    assert.throws(() => issueCheckoutQuote(mutated, clock, 120000), bad)
  }
  for (const ttl of [0, -1, 300001, Number.NaN, 1.5]) {
    assert.throws(() => issueCheckoutQuote(cart, clock, ttl), bad)
  }
  const tampered = { ...accepted, fingerprint: "sha256:tampered" }
  assert.throws(() => assertAcceptedCheckoutQuote(tampered, cart, clock + 50), bad)
  const tamperedStoredCart = { ...accepted, snapshot: changed({ currency: "eur" }) }
  assert.throws(() => assertAcceptedCheckoutQuote(tamperedStoredCart, cart, clock + 50), bad)
  console.log("SHQIPSHOP_F07G_MALFORMED_REPLAY_AND_TAMPERING_DENIED")
}
