/** F08: prove a disposed JWT can be denied only by scoped CI policy.
 * A different Store route still accepts it — explicitly demonstrating
 * that global bearer revocation and production F08 remain UNSOLVED.
 */
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {resolve,sep} from "node:path"
for(const [key,val] of Object.entries({
  CI:"true",NODE_ENV:"development",SHQIPSHOP_F08_REVOCATION_CI:"true",
  SHQIPSHOP_F07G_HTTP_CI:"true",SHQIPSHOP_REQUIRE_REDIS:"true",
  DATABASE_URL:"postgres://medusa_ci:disposable_ci_password@127.0.0.1:5432/medusa_ci",
  REDIS_URL:"redis://127.0.0.1:6379",
})) assert.equal(process.env[key],val)
const temp=process.env.RUNNER_TEMP
const file=process.env.SHQIPSHOP_F07G_REGISTERED_QUOTE_PROOF_FILE
const pk=process.env.SHQIPSHOP_CI_PUBLISHABLE_KEY_FILE
assert(temp&&file&&pk&&[file,pk].every(p=>resolve(p).startsWith(resolve(temp)+sep)))
const {owner,stranger,cartId}=JSON.parse(readFileSync(file,"utf8"))
const key=readFileSync(pk,"utf8").trim()
assert(owner?.token?.length>20 && stranger?.token?.length>20)
assert(/^cart_[A-Za-z0-9_-]{8,}$/.test(cartId))
const origin="http://127.0.0.1:9000"
async function request(method,path,token,{headers={},body}={}){
  const res=await fetch(origin+path,{
    method,
    headers:{
      "x-publishable-api-key":key,
      ...(token?{authorization:"Bearer "+token}:{}),
      ...(body?{"content-type":"application/json"}:{}),
      ...headers,
    },
    ...(body?{body:JSON.stringify(body)}:{}),
    cache:"no-store",signal:AbortSignal.timeout(20000),
  })
  let payload=null
  try{payload=await res.json()}catch{}
  return {status:res.status,payload}
}
const protectedQuote=token=>request("POST","/store/shqipshop/quote-boundary-ci",token,{
  headers:{"x-shqipshop-cart-id":cartId},
})
const revocation=(token,options={})=>request("POST","/store/shqipshop/f08-token-revoke-ci",token,options)
assert.equal((await protectedQuote(owner.token)).status,200,
  "Medusa authenticated bearer must be accepted BEFORE CI revocation")
assert([401,403,404].includes((await revocation("bad_ci_bearer")).status),
  "Unverified bearer must not create a revocation entry")
assert.equal((await revocation(owner.token,{headers:{"x-shqipshop-tenant-id":"merchant_foreign"}})).status,400)
assert.equal((await revocation(owner.token,{body:{customer_id:stranger.id}})).status,400)
assert.equal((await protectedQuote(owner.token)).status,200,
  "Rejected revocation requests must not invalidate the legitimate JWT")
const done=await revocation(owner.token)
assert.equal(done.status,200)
assert.equal(done.payload?.revoked,true)
assert.equal((await revocation(owner.token)).status,200,
  "Explicit per-token CI revocation must be idempotent")
assert.equal((await protectedQuote(owner.token)).status,401,
  "Revoked JWT must be denied by guarded CI quote boundary")
assert.equal((await request("GET","/store/shqipshop/quote-review-accept-ci?quote_id=quote_00000000-0000-4000-8000-000000000000",owner.token,{
  headers:{"x-shqipshop-cart-id":cartId},
})).status,401,"Second guarded quote endpoint must deny revoked bearer")
console.log("SHQIPSHOP_F08_DISPOSABLE_PER_TOKEN_HTTP_REVOCATION_DENIES_GUARDED_QUOTE")
const other=await request("GET","/store/customers/me",owner.token)
assert.equal(other.status,200,"Global Medusa Store endpoint remains unprotected in F08 CI pilot")
assert.equal(other.payload?.customer?.id,owner.id)
console.log("SHQIPSHOP_F08_GLOBAL_BEARER_REVOCATION_REMAINS_OPEN_STORE_ME_200")
