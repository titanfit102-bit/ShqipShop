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

export const f07gN03Scope = (cartId: string, actor: string) => ({
  tenantId: "merchant_a_ci", cartId, buyerBinding: "customer:" + actor,
})

type QuoteScope = Pick<QuoteSnapshot, "tenantId" | "cartId" | "buyerBinding">

export async function freshQuoteSnapshot(
  query: any, cart: any, scope: QuoteScope, withShipping = false,
): Promise<QuoteSnapshot> {
  if (cart.currency_code !== "all" || !Array.isArray(cart.items) || cart.items.length !== 1) denied(409)
  const shipping = withShipping && Array.isArray(cart.shipping_methods)
    ? cart.shipping_methods.map((method: any) => ({id: String(method.id), amount: money(method.amount)}))
    : []
  if (withShipping && shipping.length !== 1) denied(409)
  const cartId = scope.cartId
  const line = cart.items[0]
  const variantId = String(line.variant_id)
  const [{data: links},{data: prices}] = await Promise.all([
    query.graph({entity:"product_variant_price_set",fields:["variant_id","price_set_id"],
      filters:{variant_id:variantId}}),
    query.graph({entity:"price",fields:["id","price_set_id","currency_code","amount","updated_at"]}),
  ])
  const sets = new Set(links.map(l=>String(l.price_set_id)))
  const matching = prices.filter(p=>sets.has(String(p.price_set_id)) && p.currency_code==="all")
  if (sets.size !== 1 || matching.length !== 1) denied(409)
  const price = matching[0]
  const id = String(line.id)
  const unitPrice = money(line.unit_price)
  const lineTotal = money(line.total)
  const total = money(cart.total)
  const taxTotal = money(cart.tax_total ?? 0)
  const discountTotal = money(cart.discount_total ?? 0)
  const creditTotal = money(cart.credit_line_total ?? 0)
  // Real Medusa catalog source overrides a stale cached line price.
  const priceRevision = "price_" + digest([
    String(price.id),String(price.price_set_id),money(price.amount),price.updated_at,
  ])
  const cartRevision = "cart_" + digest([
    cartId,cart.region_id,cart.updated_at,
    [id,variantId,line.quantity,unitPrice,lineTotal],
    total,taxTotal,discountTotal,creditTotal, ...(withShipping ? [shipping] : []),
  ])
  const fresh: QuoteSnapshot = {
    ...scope, currency:"all", shipping, adjustments:[], cartRevision, pricingRevision: priceRevision,
    total,items:[{lineId:id,variantId,quantity:Number(line.quantity),
      unitAmount:unitPrice,lineTotal}],
    taxTotal,discountTotal,creditTotal,
  }
  // Never assume a stale Medusa cart unit was automatically repriced.
  if (money(price.amount) !== unitPrice) denied(409)
  if (withShipping && (taxTotal !== "0" || discountTotal !== "0" || creditTotal !== "0" ||
      !MathBN.mult(unitPrice, Number(line.quantity)).eq(lineTotal) ||
      !MathBN.add(lineTotal, shipping[0].amount).eq(total))) denied(409)
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
