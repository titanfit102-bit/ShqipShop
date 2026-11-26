import assert from "node:assert/strict"
import { ContainerRegistrationKeys, MathBN, MedusaError } from "@medusajs/framework/utils"
import { createHash } from "node:crypto"
import { fingerprintQuoteSnapshot, type QuoteSnapshot } from "./quote-contract"
import { ATTEMPT_TABLE, isN03DisposableCi } from "../../api/middlewares/n03-guest-ci"

export const QUOTE_TABLE = "shqipshop_f07g_disposable_ci_live_quotes" as const
export const isF07gN03Ci = () =>
  isN03DisposableCi("SHQIPSHOP_F07G_N03_CI") &&
  process.env.SHQIPSHOP_N03_RECOVERY_CI === "true" &&
  process.env.DATABASE_URL === "postgres://shqipshop_ci_a:merchantA_disposable@127.0.0.1:5432/shqipshop_ci_a"

export const quoteIdPattern = /^quote_[a-f0-9-]{36}$/
export const quoteFingerprintPattern = /^sha256:[a-f0-9]{64}$/
const digest = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex")
const denied = (status: number): never => { throw { status } }
export class CataloguePriceChanged extends Error {
  readonly status = 409
}

const money = (v: unknown): string => {
  if (v === null || v === undefined) return denied(409)
  const s = MathBN.convert(v as number).toString()
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(s)) return denied(409)
  return s
}

export const quoteCartFields = [
  "id", "currency_code", "region_id", "customer_id", "sales_channel_id", "updated_at", "total",
  "tax_total", "discount_total", "credit_line_total",
  "items.id", "items.variant_id", "items.quantity", "items.unit_price", "items.total",
] as const

export const quoteShippingFields = [
  "original_tax_total", "shipping_methods.id", "shipping_methods.amount",
  "shipping_methods.adjustments.id",
  "items.adjustments.id", "items.adjustments.promotion_id", "items.adjustments.amount",
] as const

export const f07gN03Scope = (cartId: string, actor: string) => ({
  tenantId: "merchant_a_ci", cartId, buyerBinding: "customer:" + actor,
})

type QuoteScope = Pick<QuoteSnapshot, "tenantId" | "cartId" | "buyerBinding">

export async function freshQuoteSnapshot(
  query: any, cart: any, scope: QuoteScope, withShipping = false,
): Promise<QuoteSnapshot> {
  if (cart.currency_code !== "all" || !Array.isArray(cart.items) || cart.items.length < 1 ||
      cart.items.length > 100 || (!withShipping && cart.items.length !== 1)) denied(409)
  const shipping = withShipping && Array.isArray(cart.shipping_methods)
    ? cart.shipping_methods.map((method: any) => ({id: String(method.id), amount: money(method.amount)}))
    : []
  if (withShipping && shipping.length !== 1) denied(409)
  if (withShipping && cart.shipping_methods[0].adjustments?.length) denied(409)

  const sortedLines = [...cart.items].sort((a, b) => String(a.id).localeCompare(String(b.id), "en"))
  const variants = [...new Set(sortedLines.map(line => String(line.variant_id)))]
  const {data: links} = await query.graph({
    entity:"product_variant_price_set", fields:["variant_id","price_set_id"], filters:{variant_id:variants},
  })
  const priceSets = [...new Set(links.map(link => String(link.price_set_id)))]
  if (priceSets.length === 0) denied(409)
  const {data: prices} = await query.graph({
    entity:"price", fields:["id","price_set_id","currency_code","amount","updated_at"],
    filters:{price_set_id:priceSets, currency_code:"all"},
  })

  const lines = sortedLines.map(line => {
    const variantId = String(line.variant_id)
    const sets = new Set(links.filter(link => link.variant_id === variantId).map(link => String(link.price_set_id)))
    const matches = prices.filter(price => sets.has(String(price.price_set_id)) && price.currency_code === "all")
    if (sets.size !== 1 || matches.length !== 1) return denied(409)
    const price = matches[0]
    const priceAmount = money(price.amount)
    const item = {
      lineId:String(line.id), variantId, quantity:Number(line.quantity),
      unitAmount:money(line.unit_price), lineTotal:money(line.total),
    }
    const adjustments = withShipping ? (line.adjustments ?? []).map((adjustment: any) => {
      const {id, promotion_id: promotionId} = adjustment
      const amount = money(adjustment.amount)
      if (typeof id !== "string" || !/^caliadj_[A-Za-z0-9_-]+$/.test(id) ||
          typeof promotionId !== "string" || !/^promo_[A-Za-z0-9_-]+$/.test(promotionId) ||
          amount === "0") return denied(409)
      return {id, amount, promotionId}
    }) : []
    return {
      item, priceAmount, adjustments,
      priceRevision:[String(price.id),String(price.price_set_id),priceAmount,price.updated_at],
      cartRevision:[item.lineId,variantId,line.quantity,item.unitAmount,item.lineTotal,
        ...(adjustments.length ? [adjustments] : [])],
    }
  })
  const items = lines.map(line => line.item)
  const total = money(cart.total)
  const taxTotal = money(cart.tax_total ?? 0)
  const discountTotal = money(cart.discount_total ?? 0)
  const creditTotal = money(cart.credit_line_total ?? 0)
  const adjustments = lines.flatMap(line => line.adjustments)
  if (withShipping && (taxTotal !== "0" || money(cart.original_tax_total ?? 0) !== "0" ||
      creditTotal !== "0" || adjustments.length > 1 ||
      (adjustments[0]?.amount ?? "0") !== discountTotal ||
      lines.some(({item, adjustments}) => !Number.isSafeInteger(item.quantity) || item.quantity < 1 ||
        !MathBN.sub(MathBN.mult(item.unitAmount, item.quantity), adjustments[0]?.amount ?? 0)
          .eq(item.lineTotal)) ||
      !items.reduce((sum, item) => MathBN.add(sum, item.lineTotal),
        MathBN.convert(shipping[0].amount)).eq(total))) denied(409)

  // Keep the legacy single-line revision shape used by the existing CI quote fixtures.
  const priceRevisions = lines.map(line => line.priceRevision)
  const cartRevisions = lines.map(line => line.cartRevision)
  const fresh: QuoteSnapshot = {
    ...scope, currency:"all", shipping, adjustments, items, total, taxTotal, discountTotal, creditTotal,
    pricingRevision: "price_" + digest(lines.length === 1 ? priceRevisions[0] : priceRevisions),
    cartRevision: "cart_" + digest([
      scope.cartId,cart.region_id,cart.updated_at,lines.length === 1 ? cartRevisions[0] : cartRevisions,
      total,taxTotal,discountTotal,creditTotal, ...(withShipping ? [shipping] : []),
    ]),
  }
  // A stale catalogue price on any line invalidates the entire quote.
  if (lines.some(line => line.priceAmount !== line.item.unitAmount)) throw new CataloguePriceChanged()
  return fresh
}

export async function verifyClaimedCheckoutQuote(cart: any, container: any) {
  if (!isF07gN03Ci()) return
  const db = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const attempt = await db(ATTEMPT_TABLE).where({cart_id:cart.id}).first("quote_required", "owner_customer_id")
  if (!attempt?.quote_required) return
  try {
    const scope = f07gN03Scope(cart.id, attempt.owner_customer_id)
    const claimed = await db(QUOTE_TABLE).where({
      cart_id: cart.id, tenant_id: scope.tenantId, buyer_binding: scope.buyerBinding, status:"claimed",
    }).first()
    const now = Date.now()
    if (!claimed || cart.customer_id !== attempt.owner_customer_id || now >= Number(claimed.expires_at_ms)) denied(409)
    const sessions = cart.payment_collection?.payment_sessions
    if (!Array.isArray(sessions) || sessions.length !== 1 || sessions[0].provider_id !== "pp_system_default" ||
        money(sessions[0].amount) !== money(cart.total)) denied(409)
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    // Use the snapshot Medusa will actually complete while it holds its cart lock.
    const fresh = await freshQuoteSnapshot(query, cart, scope, true)
    if (fingerprintQuoteSnapshot(fresh) !== claimed.fingerprint) denied(409)
  } catch {
    throw new MedusaError(MedusaError.Types.CONFLICT, "Review the updated checkout quote")
  }
}

export async function createDisposableQuoteTable(db: any) {
  const table = QUOTE_TABLE
  assert.equal(await db.schema.hasTable(table), false,
    "Never alter a pre-existing table, including other test fixtures")
  await db.schema.createTable(table, (t: any) => {
    t.string("quote_id", 80).primary()
    t.string("tenant_id", 100).notNullable()
    t.string("cart_id", 100).notNullable()
    t.string("buyer_binding", 160).notNullable()
    t.string("fingerprint", 80).notNullable()
    t.jsonb("snapshot").notNullable()
    t.bigInteger("issued_at_ms").notNullable()
    t.bigInteger("expires_at_ms").notNullable()
    t.bigInteger("accepted_at_ms").nullable()
    t.string("acceptance_nonce", 80).nullable()
    t.bigInteger("claimed_at_ms").nullable()
    t.string("claim_nonce", 80).nullable()
    t.string("status", 12).notNullable()
    t.index(["tenant_id", "cart_id", "status"], "f07g_live_ci_tenant_cart_state")
  })
  // Stronger than uniqueness per quote_id: prohibit two independent
  // accepted quote IDs being claimed for the SAME checkout cart.
  // Disposable PostgreSQL-only proof; this is NOT a Medusa order lock.
  await db.raw(`CREATE UNIQUE INDEX f07g_ci_one_claimed_per_cart
    ON "${table}" ("tenant_id", "cart_id")
    WHERE "status" = 'claimed'`)
}
