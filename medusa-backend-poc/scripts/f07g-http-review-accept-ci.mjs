/**
 * CI-only HTTP review + deliberate acceptance for a real disposable Medusa
 * cart and pre-issued temporary PostgreSQL quote. No production checkout.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve,sep } from "node:path"

const expected={
  CI:"true",NODE_ENV:"development",SHQIPSHOP_REQUIRE_REDIS:"true",
  SHQIPSHOP_F07G_HTTP_CI:"true",SHQIPSHOP_F07G_REAL_CART_CI:"true",
  DATABASE_URL:"postgres://medusa_ci:disposable_ci_password@127.0.0.1:5432/medusa_ci",
  REDIS_URL:"redis://127.0.0.1:6379",
}
for(const [k,v] of Object.entries(expected)) assert.equal(process.env[k],v)
const stage=process.argv[2]
assert(["before","after"].includes(stage))
const tmp=process.env.RUNNER_TEMP
const paths=[
  process.env.SHQIPSHOP_F07E_REPRICE_PROOF_FILE,
  process.env.SHQIPSHOP_F07G_REAL_CART_PROOF_FILE,
  process.env.SHQIPSHOP_CI_PUBLISHABLE_KEY_FILE,
]
assert(tmp&&paths.every(p=>p&&resolve(p).startsWith(resolve(tmp)+sep)))
const {cartId}=JSON.parse(readFileSync(paths[0],"utf8"))
const {httpQuote,staleHttpQuote}=JSON.parse(readFileSync(paths[1],"utf8"))
const key=readFileSync(paths[2],"utf8").trim()
assert(/^cart_[a-zA-Z0-9_-]{8,}$/.test(cartId))
assert(key.length>10)
for(const q of [httpQuote,staleHttpQuote]){
  assert(/^quote_[a-f0-9-]{36}$/.test(q.id))
  assert(/^sha256:[a-f0-9]{64}$/.test(q.fingerprint))
}
const endpoint="http://127.0.0.1:9000/store/shqipshop/quote-review-accept-ci"
const denied=status=>[400,401,403,404,409].includes(status)
const baseHeaders={
  "x-publishable-api-key":key,"x-shqipshop-cart-id":cartId,
  "x-shqipshop-cart-proof":cartId,
}
async function request(method,quote,{headers={},body}={}){
  const response=await fetch(endpoint+(method==="GET"?"?quote_id="+encodeURIComponent(quote.id):""),{
    method,headers:{...baseHeaders,...headers,...body?{"content-type":"application/json"}:{}},
    ...body?{body:JSON.stringify(body)}:{},
    signal:AbortSignal.timeout(20000),cache:"no-store",
  })
  let json=null
  const text=await response.text()
  try{json=text?JSON.parse(text):null}catch{}
  return {status:response.status,json}
}
const accept=(quote,opts={})=>request("POST",quote,{
  ...opts,body:opts.body??{quote_id:quote.id,fingerprint:quote.fingerprint},
})
if(stage==="before"){
  const reviewed=await request("GET",httpQuote)
  assert.equal(reviewed.status,200,"Owned guest quote should be reviewable")
  assert.equal(reviewed.json.quote_id,httpQuote.id)
  assert.equal(reviewed.json.fingerprint,httpQuote.fingerprint)
  assert.equal(reviewed.json.currency,"all")
  assert.match(reviewed.json.total,/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/)
  assert(!JSON.stringify(reviewed.json).includes(cartId),"Never reveal raw cart capability")
  console.log("SHQIPSHOP_F07G_REAL_HTTP_SERVER_ISSUED_QUOTE_REVIEW_PASSED")

  const negatives=[
    ["missing proof",()=>request("GET",httpQuote,{headers:{"x-shqipshop-cart-proof":""}})],
    ["foreign proof",()=>request("GET",httpQuote,{headers:{"x-shqipshop-cart-proof":"cart_wrong_12345678"}})],
    ["wrong cart",()=>request("GET",httpQuote,{headers:{"x-shqipshop-cart-id":"cart_wrong_12345678"}})],
    ["forged tenant",()=>request("GET",httpQuote,{headers:{"x-shqipshop-tenant-id":"merchant_foreign"}})],
    ["invalid bearer + correct proof",()=>request("GET",httpQuote,{headers:{authorization:"Bearer forged_ci_token"}})],
    ["cookie forbidden without csrf",()=>accept(httpQuote,{headers:{cookie:"connect.sid=invalid_ci_session"}})],
    ["wrong fingerprint",()=>accept(httpQuote,{body:{quote_id:httpQuote.id,fingerprint:"sha256:"+"f".repeat(64)}})],
    ["client total injection",()=>accept(httpQuote,{body:{quote_id:httpQuote.id,fingerprint:httpQuote.fingerprint,total:"0"}})],
    ["foreign quote",()=>request("GET",{id:"quote_00000000-0000-4000-8000-000000000000"})],
  ]
  for(const [name,fn] of negatives){
    const result=await fn()
    assert(denied(result.status),name+" unexpectedly allowed HTTP "+result.status)
  }
  const attempts=await Promise.all([accept(httpQuote),accept(httpQuote)])
  assert.equal(attempts.filter(x=>x.status===200).length,1,
    "Exactly one buyer acceptance at HTTP boundary, despite concurrency")
  assert.equal(attempts.filter(x=>x.status===409).length,1,
    "Losing HTTP acceptance must explicitly be 409 conflict")
  assert.equal(attempts.find(x=>x.status===200)?.json?.accepted,true)
  assert.equal((await accept(httpQuote)).status,409,"Replay should return 409")
  console.log("SHQIPSHOP_F07G_REAL_HTTP_BUYER_ACCEPTANCE_ATOMIC_AND_REPLAY_409")
}else{
  const staleRead=await request("GET",staleHttpQuote)
  assert.equal(staleRead.status,409,"Changed Medusa catalogue must invalidate quote review")
  const stalePost=await accept(staleHttpQuote)
  assert.equal(stalePost.status,409,"Repriced quote must reject HTTP acceptance")
  const repeated=(await accept(httpQuote))
  assert.equal(repeated.status,409,"Previously accepted quote must not be re-accepted")
  console.log("SHQIPSHOP_F07G_REAL_HTTP_STALE_REPRICE_REVIEW_AND_ACCEPT_409")
}
