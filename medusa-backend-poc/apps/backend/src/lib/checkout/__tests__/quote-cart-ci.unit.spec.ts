import { freshQuoteSnapshot } from "../quote-cart-ci"
import { fingerprintQuoteSnapshot } from "../quote-contract"

const query = {
  async graph({ entity }: { entity: string }) {
    switch (entity) {
      case "product_variant_price_set":
        return { data: [{ variant_id: "variant_shorts", price_set_id: "pset_shorts" }] }
      case "price":
        return { data: [{ id: "price_shorts", price_set_id: "pset_shorts", currency_code: "all", amount: 1500 }] }
      default:
        throw new Error("Unexpected cart quote query")
    }
  },
}
const scope = { tenantId: "merchant_a_ci", cartId: "cart_shorts", buyerBinding: "customer:cus_buyer" }

function cartWithDiscount() {
  return {
    currency_code: "all", region_id: "reg_al", updated_at: "2026-11-26",
    total: 1410, discount_total: 100, tax_total: 0, original_tax_total: 0, credit_line_total: 0,
    shipping_methods: [{ id: "casm_standard", amount: 10, adjustments: [] }],
    items: [{
      id: "cali_shorts", variant_id: "variant_shorts", quantity: 1, unit_price: 1500, total: 1400,
      adjustments: [{ id: "caliadj_discount", promotion_id: "promo_shorts", amount: 100 }],
    }],
  }
}

it("binds a single Medusa line discount and the net ALL amount to the quote", async () => {
  const cart = cartWithDiscount()
  const quote = await freshQuoteSnapshot(query, cart, scope, true)
  expect(quote).toMatchObject({
    total: "1410",
    discountTotal: "100",
    items: [{ unitAmount: "1500", lineTotal: "1400" }],
    adjustments: [{ id: "caliadj_discount", amount: "100" }],
  })
  cart.items[0].adjustments[0].id = "caliadj_replacement"
  const replaced = await freshQuoteSnapshot(query, cart, scope, true)
  expect(fingerprintQuoteSnapshot(replaced)).not.toBe(fingerprintQuoteSnapshot(quote))
})

it("rejects a discounted cart when its persisted adjustment disagrees with the total", async () => {
  const cart = cartWithDiscount()
  cart.items[0].adjustments[0].amount = 99
  await expect(freshQuoteSnapshot(query, cart, scope, true)).rejects.toEqual({ status: 409 })
})

it("rejects multiple line adjustments even when their sum matches", async () => {
  const cart = cartWithDiscount()
  cart.items[0].adjustments[0].amount = 50
  cart.items[0].adjustments.push({ id: "caliadj_other", promotion_id: "promo_other", amount: 50 })
  await expect(freshQuoteSnapshot(query, cart, scope, true)).rejects.toEqual({ status: 409 })
})
