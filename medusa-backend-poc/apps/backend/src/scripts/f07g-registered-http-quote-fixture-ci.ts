/**
 * F07g 2C-4 — issue disposable owner-scoped quotes for a REAL Medusa customer
 * cart that was authenticated/created by the HTTP runner. No production schema,
 * no payment/order actions, no trust in the client's amount, no token logging.
 */
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import { resolve, sep } from "node:path"
import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MathBN } from "@medusajs/framework/utils"
import { bindVerifiedQuotePrincipal } from "../lib/checkout/quote-principal"
import { issueCheckoutQuote, type CheckoutQuote, type QuoteSnapshot } from "../lib/checkout/quote-contract"

const TABLE="shqipshop_f07g_disposable_ci_live_quotes"
const hash=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex")
const money=(v:unknown):string=>{
  assert(v!==null&&v!==undefined,"Missing server monetary field")
  const s=MathBN.convert(v as number).toString()
  assert(/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(s),"Invalid price from Medusa")
  return s
}
export default async function verify({container}:ExecArgs){
  const required:Record<string,string>={
    CI:"true",NODE_ENV:"development",SHQIPSHOP_REQUIRE_REDIS:"true",
    SHQIPSHOP_F07G_REAL_CART_CI:"true",SHQIPSHOP_F07G_HTTP_CI:"true",
    DATABASE_URL:"postgres://medusa_ci:disposable_ci_password@127.0.0.1:5432/medusa_ci",
    REDIS_URL:"redis://127.0.0.1:6379",
  }
  for(const [key,value] of Object.entries(required)){
    assert.equal(process.env[key],value,key)
  }
  const file=process.env.SHQIPSHOP_F07G_REGISTERED_QUOTE_PROOF_FILE
  const temp=process.env.RUNNER_TEMP
  assert(file&&temp&&resolve(file).startsWith(resolve(temp)+sep),
    "Runner-only registered quote fixture path required")
  const proof=JSON.parse(readFileSync(file,"utf8")) as {
    owner:{id:string;token:string};stranger:{id:string;token:string}
    cartId:string;variantId:string
  }
  assert(/^cart_[A-Za-z0-9_-]{8,}$/.test(proof.cartId))
  assert(/^variant_[A-Za-z0-9_-]{8,}$/.test(proof.variantId))
  assert(/^cus_[A-Za-z0-9_-]{8,}$/.test(proof.owner.id))
  assert.notEqual(proof.owner.id,proof.stranger.id)
  const query=container.resolve(ContainerRegistrationKeys.QUERY)
  const db:any=container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  assert.equal(await db.schema.hasTable(TABLE),true,
    "Disposable guest Medusa live quote table must already exist")
  const [{data:carts},{data:links},{data:prices}]=await Promise.all([
    query.graph({
      entity:"cart",
      fields:[
        "id","currency_code","region_id","customer_id","updated_at","total",
        "tax_total","discount_total","credit_line_total",
        "items.id","items.variant_id","items.quantity","items.unit_price","items.total",
      ],
      filters:{id:proof.cartId},
    }),
    query.graph({entity:"product_variant_price_set",
      fields:["variant_id","price_set_id"],filters:{variant_id:proof.variantId}}),
    query.graph({entity:"price",
      fields:["id","price_set_id","currency_code","amount","updated_at"]}),
  ])
  assert.equal(carts.length,1)
  const cart=carts[0]
  assert.equal(cart.currency_code,"all")
  assert.equal(cart.customer_id,proof.owner.id,
    "Server query must confirm customer ownership independently")
  assert(Array.isArray(cart.items)&&cart.items.length===1)
  const line=cart.items[0]
  assert.equal(line.variant_id,proof.variantId)
  assert.equal(Number(line.quantity),1)
  assert(/^cali_[A-Za-z0-9_-]{8,}$/.test(String(line.id)))
  const sets=new Set(links.map(p=>String(p.price_set_id)))
  assert.equal(sets.size,1)
  const linked=prices.filter(p=>sets.has(String(p.price_set_id))&&p.currency_code==="all")
  assert.equal(linked.length,1)
  const price=linked[0]
  const unit=money(line.unit_price),lineTotal=money(line.total)
  const total=money(cart.total),tax=money(cart.tax_total??0)
  const discount=money(cart.discount_total??0)
  const credit=money(cart.credit_line_total??0)
  assert.equal(unit,money(price.amount),
    "Cannot issue registered quote against stale cart catalogue amount")
  assert(MathBN.convert(lineTotal).eq(MathBN.convert(unit)),
    "Expected exactly one unit in disposable cart")
  assert(MathBN.convert(total).eq(MathBN.sub(MathBN.add(lineTotal,tax),discount)),
    "Medusa total must reconcile in narrow CI fixture")
  assert.equal(discount,"0")
  assert.equal(credit,"0")
  assert.equal(tax,"0")
  const principal=bindVerifiedQuotePrincipal({
    deploymentTenantId:"merchant_ci_isolated",
    trustedCart:{id:proof.cartId,customerId:String(cart.customer_id)},
    validatedAuthContext:{actorType:"customer",actorId:proof.owner.id},
    authorizationAttempted:true,
    guestCartProof:null,
    serverSecret:process.env.JWT_SECRET??"",
  })
  const snapshot:QuoteSnapshot={
    ...principal,
    cartRevision:"cart_"+hash([
      proof.cartId,cart.region_id,cart.updated_at,
      [String(line.id),proof.variantId,line.quantity,unit,lineTotal],
      total,tax,discount,credit,
    ]),
    pricingRevision:"price_"+hash([
      String(price.id),String(price.price_set_id),money(price.amount),price.updated_at,
    ]),
    currency:"all",total,
    items:[{lineId:String(line.id),variantId:proof.variantId,quantity:1,
      unitAmount:unit,lineTotal}],
    shipping:[],adjustments:[],
    taxTotal:tax,discountTotal:discount,creditTotal:credit,
  }
  const now=Date.now()
  const issued=issueCheckoutQuote(snapshot,now,300000)
  const stale=issueCheckoutQuote(snapshot,now,300000)
  async function persist(q:CheckoutQuote){
    await db(TABLE).insert({
      quote_id:q.id,tenant_id:q.snapshot.tenantId,cart_id:q.snapshot.cartId,
      buyer_binding:q.snapshot.buyerBinding,fingerprint:q.fingerprint,
      snapshot:JSON.stringify(q.snapshot),status:"quoted",
      issued_at_ms:q.issuedAtMs,expires_at_ms:q.expiresAtMs,
    })
  }
  await persist(issued)
  await persist(stale)
  writeFileSync(file,JSON.stringify({
    ...proof,quote:{id:issued.id,fingerprint:issued.fingerprint},
    staleQuote:{id:stale.id,fingerprint:stale.fingerprint},
  }),{flag:"w",mode:0o600})
  console.log("SHQIPSHOP_F07G_REAL_MEDUSA_CUSTOMER_DB_SCOPED_QUOTES_ISSUED_CI_ONLY")
}
