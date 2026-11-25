import type { AuthenticatedMedusaRequest, MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  acceptCheckoutQuote, canonicalQuoteSnapshot, fingerprintQuoteSnapshot, issueCheckoutQuote,
  type CheckoutQuote, type QuoteSnapshot,
} from "../../../../lib/checkout/quote-contract"
import { freshQuoteSnapshot, f07gN03Scope, isF07gN03Ci, QUOTE_TABLE as TABLE,
  quoteCartFields, quoteFingerprintPattern as fpPattern, quoteIdPattern } from "../../../../lib/checkout/quote-cart-ci"
import { ATTEMPT_TABLE, hasN03CartChannel } from "../../../middlewares/n03-guest-ci"
import { registeredActor, isN03RegisteredCustomer } from "../../../middlewares/n03-registered-ci"
import { bindVerifiedQuotePrincipal } from "../../../../lib/checkout/quote-principal"

/**
 * F07g 2C-3: Disposable CI-only HTTP review/accept bridge.
 * Registered A/B fixtures may review a fresh server quote. Medusa handles
 * order and payment operations. It may only act on the temporary table created by the CI runner.
 * NOT authorized for production traffic or schema migrations.
 */
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

const cartIdPattern = /^cart_[A-Za-z0-9_-]{8,}$/
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
  quoteId?: string
  fingerprint?: string
  scope: {tenantId: string; cartId: string; buyerBinding: string}
  fresh: QuoteSnapshot
}

async function verifyRequest(req: AuthenticatedMedusaRequest & MedusaStoreRequest, post: boolean): Promise<Context> {
  // This disposable route deliberately does NOT support cookie auth. Any
  // eventual production cookie POST must get an independently reviewed CSRF
  // and origin policy. Bearer customer auth and guest proof work in CI.
  if (req.headers.cookie) denied(401)
  if (req.headers["x-shqipshop-tenant-id"] !== undefined ||
      req.headers["x-merchant-id"] !== undefined) denied(400)

  if (!post && req.body && Object.keys(req.body as object).length) denied(400)
  const joint = isF07gN03Ci()
  const input: any = post ? req.body : req.query
  const issue = joint && post && input?.review === true && Object.keys(input).length === 1
  if (!input || typeof input !== "object" || Array.isArray(input) ||
      (post && !issue && Object.keys(input).sort().join(",") !== "fingerprint,quote_id") ||
      (!post && !issue && Object.keys(input).join(",") !== "quote_id")) denied(400)
  const quoteId = input.quote_id
  const fingerprint = post ? input.fingerprint : undefined
  if ((!issue && (typeof quoteId !== "string" || !quoteIdPattern.test(quoteId))) ||
      (post && !issue && (typeof fingerprint !== "string" || !fpPattern.test(fingerprint)))) denied(400)

  const cartId = req.headers["x-shqipshop-cart-id"]
  const proof = req.headers["x-shqipshop-cart-proof"]
  if (typeof cartId !== "string" || !cartIdPattern.test(cartId) ||
      (proof !== undefined && typeof proof !== "string")) return denied(404)

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const db: any = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const { data: carts } = await query.graph({
    entity: "cart",
    fields: [...quoteCartFields, ...(joint ? ["shipping_methods.id","shipping_methods.amount"] : [])],
    filters: {id: cartId},
  })
  if (carts.length !== 1) denied(404)
  const cart = carts[0]
  let scope: Context["scope"]
  if (joint) {
    const actor = registeredActor(req)
    if (!actor || cart.customer_id !== actor || !hasN03CartChannel(req, cart.sales_channel_id) ||
        !await isN03RegisteredCustomer(req, actor)) return denied(404)
    const attempt = await db(ATTEMPT_TABLE).where({cart_id:cartId, owner_customer_id:actor})
      .first("quote_required", "phase")
    if (!attempt?.quote_required || attempt.phase !== "prepared") return denied(409)
    scope = f07gN03Scope(cartId, actor)
  } else {
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
    } catch { return denied(404) }
    scope = {tenantId:principal.tenantId,cartId:principal.cartId,buyerBinding:principal.buyerBinding}
  }
  if (issue) return {db, scope, fresh: await freshQuoteSnapshot(query, cart, scope, true)}
  const row = await db(TABLE).where({
    quote_id:quoteId, tenant_id:scope.tenantId,
    cart_id:scope.cartId,buyer_binding:scope.buyerBinding,
  }).first()
  if (!row) denied(404)
  const stored = dbQuote(row)
  const snapshot = canonicalQuoteSnapshot(stored.snapshot)
  const fresh = await freshQuoteSnapshot(query, cart, scope, joint)
  if (fingerprintQuoteSnapshot(snapshot) !== stored.fingerprint ||
      fingerprintQuoteSnapshot(fresh) !== stored.fingerprint ||
      snapshot.cartId !== cartId) denied(409)
  const now = Date.now()
  if (stored.status !== "quoted" || now < stored.issuedAtMs || now >= stored.expiresAtMs) denied(409)
  return {db,quoteId,fingerprint,scope,fresh}
}

const handle = async (req: AuthenticatedMedusaRequest & MedusaStoreRequest,res: MedusaResponse,post: boolean) => {
  res.setHeader("Cache-Control","no-store, max-age=0")
  if (!enabled() && !isF07gN03Ci()) return res.sendStatus(404)
  try {
    const ctx = await verifyRequest(req,post)
    if (!ctx.quoteId) {
      const quote = issueCheckoutQuote(ctx.fresh, Date.now(), 300000)
      await ctx.db(TABLE).insert({
        quote_id:quote.id, tenant_id:ctx.scope.tenantId, cart_id:ctx.scope.cartId,
        buyer_binding:ctx.scope.buyerBinding, fingerprint:quote.fingerprint,
        snapshot:JSON.stringify(quote.snapshot), issued_at_ms:quote.issuedAtMs,
        expires_at_ms:quote.expiresAtMs, status:"quoted",
      })
      return res.status(200).json({
        quote_id:quote.id, fingerprint:quote.fingerprint, currency:quote.snapshot.currency,
        total:quote.snapshot.total, expires_at_ms:quote.expiresAtMs,
      })
    }
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
          {quoteId:ctx.quoteId!,fingerprint:ctx.fingerprint!},ctx.fresh,now)
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
export const GET = (req: AuthenticatedMedusaRequest & MedusaStoreRequest,res: MedusaResponse) => handle(req,res,false)
export const POST = (req: AuthenticatedMedusaRequest & MedusaStoreRequest,res: MedusaResponse) => handle(req,res,true)
