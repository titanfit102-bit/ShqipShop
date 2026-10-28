import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MathBN } from "@medusajs/framework/utils"
import { createHash } from "node:crypto"
import {
  acceptCheckoutQuote, canonicalQuoteSnapshot, fingerprintQuoteSnapshot,
  type CheckoutQuote, type QuoteSnapshot,
} from "../../../../lib/checkout/quote-contract"
import { bindVerifiedQuotePrincipal } from "../../../../lib/checkout/quote-principal"

/**
 * F07g 2C-3: Disposable CI-only HTTP review/accept bridge.
 * This route never issues quotes, handles payments, reserves stock or creates
 * orders. It may only act on the temporary table created by the CI runner.
 * NOT authorized for production traffic or schema migrations.
 */
const TABLE = "shqipshop_f07g_disposable_ci_live_quotes"
const TENANT = "merchant_ci_isolated"
const enabled = () =>
  process.env.CI === "true" &&
  process.env.NODE_ENV === "development" &&
  process.env.SHQIPSHOP_REQUIRE_REDIS === "true" &&
  process.env.SHQIPSHOP_F07G_HTTP_CI === "true" &&
  process.env.SHQIPSHOP_F07G_REAL_CART_CI === "true" &&
  process.env.DATABASE_URL === "postgres://medusa_ci:disposable_ci_password@127.0.0.1:5432/medusa_ci" &&
  process.env.REDIS_URL === "redis://127.0.0.1:6379" &&
  /^[a-f0-9]{64}$/.test(process.env.JWT_SECRET ?? "")

const digest = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex")
const money = (v: unknown): string => {
  if (v === null || v === undefined) throw new Error("invalid cart money")
  const s = MathBN.convert(v as number).toString()
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(s)) throw new Error("invalid cart money")
  return s
}
const cartIdPattern = /^cart_[A-Za-z0-9_-]{8,}$/
const quoteIdPattern = /^quote_[a-f0-9-]{36}$/
const fpPattern = /^sha256:[a-f0-9]{64}$/
const denied = (code: number) => { throw { status: code } }
const dbQuote = (row: any): CheckoutQuote => ({
  id: row.quote_id, fingerprint: row.fingerprint,
  snapshot: typeof row.snapshot === "string" ? JSON.parse(row.snapshot) : row.snapshot,
  status: row.status,
  issuedAtMs: Number(row.issued_at_ms), expiresAtMs: Number(row.expires_at_ms),
  ...(row.accepted_at_ms == null ? {} : { acceptedAtMs: Number(row.accepted_at_ms) }),
  ...(row.acceptance_nonce ? { acceptanceNonce: row.acceptance_nonce } : {}),
})

type Context = {
  db: any
  quoteId: string
  fingerprint?: string
  scope: {tenantId: string; cartId: string; buyerBinding: string}
  fresh: QuoteSnapshot
}

async function verifyRequest(req: AuthenticatedMedusaRequest, post: boolean): Promise<Context> {
  // This disposable route deliberately does NOT support cookie auth. Any
  // eventual production cookie POST must get an independently reviewed CSRF
  // and origin policy. Bearer customer auth and guest proof work in CI.
  if (req.headers.cookie) denied(401)
  if (req.headers["x-shqipshop-tenant-id"] !== undefined ||
      req.headers["x-merchant-id"] !== undefined) denied(400)

  if (!post && req.body && Object.keys(req.body as object).length) denied(400)
  const input: any = post ? req.body : req.query
  if (!input || typeof input !== "object" || Array.isArray(input) ||
      (post && Object.keys(input).sort().join(",") !== "fingerprint,quote_id") ||
      (!post && Object.keys(input).join(",") !== "quote_id")) denied(400)
  const quoteId = input.quote_id
  const fingerprint = post ? input.fingerprint : undefined
  if (typeof quoteId !== "string" || !quoteIdPattern.test(quoteId) ||
      (post && (typeof fingerprint !== "string" || !fpPattern.test(fingerprint)))) denied(400)

  const cartId = req.headers["x-shqipshop-cart-id"]
  const proof = req.headers["x-shqipshop-cart-proof"]
  if (typeof cartId !== "string" || !cartIdPattern.test(cartId) ||
      (proof !== undefined && typeof proof !== "string")) denied(404)

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const db: any = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const { data: carts } = await query.graph({
    entity: "cart",
    fields: [
      "id","currency_code","region_id","customer_id","updated_at","total",
      "tax_total","discount_total","credit_line_total",
      "items.id","items.variant_id","items.quantity","items.unit_price","items.total",
    ],
    filters: {id: cartId},
  })
  if (carts.length !== 1) denied(404)
  const cart = carts[0]
  let principal
  try {
    const actorType = req.auth_context?.actor_type
    const actorId = req.auth_context?.actor_id
    principal = bindVerifiedQuotePrincipal({
      deploymentTenantId: TENANT,
      trustedCart: {id:String(cart.id), customerId:cart.customer_id ? String(cart.customer_id) : null},
      validatedAuthContext: actorType && actorId ? {actorType,actorId} : null,
      authorizationAttempted: Boolean(req.headers.authorization),
      guestCartProof: typeof proof === "string" ? proof : null,
      serverSecret: process.env.JWT_SECRET!,
    })
  } catch { denied(404) }

  const scope = {tenantId:principal.tenantId,cartId:principal.cartId,buyerBinding:principal.buyerBinding}
  const row = await db(TABLE).where({
    quote_id:quoteId, tenant_id:scope.tenantId,
    cart_id:scope.cartId,buyer_binding:scope.buyerBinding,
  }).first()
  if (!row) denied(404)
  const stored = dbQuote(row)
  const snapshot = canonicalQuoteSnapshot(stored.snapshot)
  // This CI adapter is intentionally restricted to the disposable
  // one-line/no-discount/no-shipping case. Full pricing rules are NOT proven.
  if (cart.currency_code !== "all" || snapshot.currency !== "all" ||
      snapshot.items.length !== 1 || snapshot.shipping.length !== 0 ||
      snapshot.adjustments.length !== 0 || !Array.isArray(cart.items) ||
      cart.items.length !== 1) denied(409)
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
    total,taxTotal,discountTotal,creditTotal,
  ])
  const fresh: QuoteSnapshot = {
    ...snapshot, ...scope, cartRevision, pricingRevision: priceRevision,
    total,items:[{lineId:id,variantId,quantity:Number(line.quantity),
      unitAmount:unitPrice,lineTotal}],
    taxTotal,discountTotal,creditTotal,
  }
  // Never assume a stale Medusa cart unit was automatically repriced.
  if (money(price.amount) !== unitPrice) denied(409)
  if (fingerprintQuoteSnapshot(snapshot) !== stored.fingerprint ||
      fingerprintQuoteSnapshot(fresh) !== stored.fingerprint ||
      snapshot.cartId !== cartId) denied(409)
  const now = Date.now()
  if (stored.status !== "quoted" || now < stored.issuedAtMs || now >= stored.expiresAtMs) denied(409)
  return {db,quoteId,fingerprint,scope,fresh}
}

const handle = async (req: AuthenticatedMedusaRequest,res: MedusaResponse,post: boolean) => {
  res.setHeader("Cache-Control","no-store, max-age=0")
  if (!enabled()) return res.sendStatus(404)
  try {
    const ctx = await verifyRequest(req,post)
    if (!post) {
      // Read-only quote preview. It does not itself signify buyer consent.
      const row = await ctx.db(TABLE).where({
        quote_id:ctx.quoteId,tenant_id:ctx.scope.tenantId,
        cart_id:ctx.scope.cartId,buyer_binding:ctx.scope.buyerBinding,
        status:"quoted",
      }).first()
      if (!row) denied(409)
      return res.status(200).json({
        quote_id:ctx.quoteId, fingerprint:row.fingerprint,
        currency:ctx.fresh.currency,total:ctx.fresh.total,
        expires_at_ms:Number(row.expires_at_ms),
      })
    }
    const now = Date.now()
    const changed = await ctx.db.transaction(async (trx: any) => {
      const row = await trx(TABLE).where({
        quote_id:ctx.quoteId, tenant_id:ctx.scope.tenantId,
        cart_id:ctx.scope.cartId,buyer_binding:ctx.scope.buyerBinding,
      }).first()
      if (!row) return 0
      try {
        const accepted = acceptCheckoutQuote(dbQuote(row),
          {quoteId:ctx.quoteId,fingerprint:ctx.fingerprint!},ctx.fresh,now)
        return (await trx(TABLE).where({
          quote_id:ctx.quoteId,tenant_id:ctx.scope.tenantId,
          cart_id:ctx.scope.cartId,buyer_binding:ctx.scope.buyerBinding,
          status:"quoted",fingerprint:accepted.fingerprint,
        }).andWhere("expires_at_ms",">",now)
          .update({status:"accepted",accepted_at_ms:now,
            acceptance_nonce:accepted.acceptanceNonce})
          .returning("quote_id")).length
      } catch { return 0 }
    })
    if (changed !== 1) denied(409)
    return res.status(200).json({accepted:true,quote_id:ctx.quoteId})
  } catch (e: any) {
    // Fail closed, do not leak quote or customer existence.
    return res.sendStatus([400,401,404,409].includes(e?.status) ? e.status : 404)
  }
}
export const GET = (req: AuthenticatedMedusaRequest,res: MedusaResponse) => handle(req,res,false)
export const POST = (req: AuthenticatedMedusaRequest,res: MedusaResponse) => handle(req,res,true)
