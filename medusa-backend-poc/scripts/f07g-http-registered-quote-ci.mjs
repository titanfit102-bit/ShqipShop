/**
 * F07g 2C-4: CI-only Medusa registered owner quote HTTP setup / verification.
 * Never logs credentials, JWT, guest proof, personal/customer information.
 * Uses ONLY disposable local CI Medusa and temp files.
 */
import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import { resolve,sep } from "node:path"

const required={
  CI:"true",NODE_ENV:"development",SHQIPSHOP_REQUIRE_REDIS:"true",
  SHQIPSHOP_F07G_HTTP_CI:"true",SHQIPSHOP_F07G_REAL_CART_CI:"true",
  DATABASE_URL:"postgres://medusa_ci:disposable_ci_password@127.0.0.1:5432/medusa_ci",
  REDIS_URL:"redis://127.0.0.1:6379",
}
for(const [k,v] of Object.entries(required)) assert.equal(process.env[k],v)
const phase=process.argv[2]
assert(["setup","verify","after"].includes(phase))
const temp=process.env.RUNNER_TEMP
const paths=[
  process.env.SHQIPSHOP_CI_PUBLISHABLE_KEY_FILE,
  process.env.SHQIPSHOP_F07E_REPRICE_PROOF_FILE,
  process.env.SHQIPSHOP_F07G_REGISTERED_QUOTE_PROOF_FILE,
]
assert(temp&&paths.every(x=>x&&resolve(x).startsWith(resolve(temp)+sep)))
const key=readFileSync(paths[0],"utf8").trim()
assert(key.length>10)
const base="http://127.0.0.1:9000"
const route="/store/shqipshop/quote-review-accept-ci"
async function http(method,path,{token,headers={},body}={}){
  const res=await fetch(base+path,{
    method,headers:{
      "x-publishable-api-key":key,
      ...(token?{authorization:"Bearer "+token}:{}),
      ...(body?{"content-type":"application/json"}:{}),...headers,
    },...(body?{body:JSON.stringify(body)}:{}),
    signal:AbortSignal.timeout(20000),cache:"no-store",
  })
  const txt=await res.text()
  let json=null
  try{json=txt?JSON.parse(txt):null}catch{}
  return {status:res.status,data:json}
}
const expectDenied=(response,label)=>
  assert([400,401,403,404,409].includes(response.status),
    label+" unexpectedly authorized: HTTP "+response.status)
async function registered(label){
  const email="f07g-quote-"+label+"-"+randomBytes(7).toString("hex")+"@example.invalid"
  const password=randomBytes(28).toString("hex")
  const reg=await http("POST","/auth/customer/emailpass/register",{
    body:{email,password},
  })
  assert([200,201].includes(reg.status)&&reg.data?.token,
    "Synthetic customer register failed")
  const customer=await http("POST","/store/customers",{
    token:reg.data.token,
    body:{email,first_name:"Synthetic",last_name:label},
  })
  assert([200,201].includes(customer.status)&&customer.data?.customer?.id,
    "Medusa synthetic customer creation failed")
  const login=await http("POST","/auth/customer/emailpass",{body:{email,password}})
  assert.equal(login.status,200,"Medusa customer login failed")
  assert(login.data?.token?.length>20)
  return {id:customer.data.customer.id,token:login.data.token}
}
const file=paths[2]
if(phase==="setup"){
  const owner=await registered("owner")
  const stranger=await registered("stranger")
  const regions=await http("GET","/store/regions")
  assert.equal(regions.status,200)
  const region=regions.data?.regions?.find(r=>r.name==="Shqipëri"&&r.currency_code==="all")
  assert(region?.id)
  const repricing=JSON.parse(readFileSync(paths[1],"utf8"))
  const variantId=repricing.variantId
  assert(typeof variantId==="string"&&/^variant_[A-Za-z0-9_-]{8,}$/.test(variantId))
  const created=await http("POST","/store/carts",{token:owner.token,body:{region_id:region.id}})
  assert.equal(created.status,200,"Registered cart creation failed")
  const cartId=created.data?.cart?.id
  assert(/^cart_[A-Za-z0-9_-]{8,}$/.test(cartId||""))
  const linked=await http("POST","/store/carts/"+cartId+"/customer",{token:owner.token})
  assert.equal(linked.status,200,"Customer cart association failed")
  const added=await http("POST","/store/carts/"+cartId+"/line-items",{
    token:owner.token,body:{variant_id:variantId,quantity:1},
  })
  assert.equal(added.status,200,"Registered cart product add failed")
  const own=await http("GET","/store/carts/"+cartId,{token:owner.token})
  assert.equal(own.status,200)
  assert.equal(own.data?.cart?.customer_id,owner.id,
    "Medusa must persist true cart ownership before quote issuance")
  assert.equal(own.data?.cart?.items?.length,1)
  writeFileSync(file,JSON.stringify({owner,stranger,cartId,variantId}),{
    flag:"wx",mode:0o600,
  })
  console.log("SHQIPSHOP_F07G_REAL_HTTP_REGISTERED_CART_OWNERSHIP_SETUP_PASSED")
}else{
  const proof=JSON.parse(readFileSync(file,"utf8"))
  const {owner,stranger,cartId,quote,staleQuote}=proof
  for(const q of [quote,staleQuote]){
    assert(/^quote_[a-f0-9-]{36}$/.test(q?.id??""))
    assert(/^sha256:[a-f0-9]{64}$/.test(q?.fingerprint??""))
  }
  const headers={"x-shqipshop-cart-id":cartId}
  const review=(q,opts={})=>http("GET",route+"?quote_id="+q.id,{
    token:opts.token,headers:{...headers,...opts.headers},
  })
  const accept=(q,opts={})=>http("POST",route,{
    token:opts.token,headers:{...headers,...opts.headers},
    body:opts.body??{quote_id:q.id,fingerprint:q.fingerprint},
  })
  if(phase==="verify"){
    const good=await review(quote,{token:owner.token})
    assert.equal(good.status,200,"Registered owner quote must be reviewable")
    assert.equal(good.data?.quote_id,quote.id)
    assert.equal(good.data?.fingerprint,quote.fingerprint)
    assert.equal(good.data?.currency,"all")
    assert(!JSON.stringify(good.data).includes(owner.id),
      "Quote review must not disclose customer identity")
    for(const [label,fn] of [
      ["foreign owner review",()=>review(quote,{token:stranger.token})],
      ["foreign account with guest proof",()=>review(quote,{
        token:stranger.token,headers:{"x-shqipshop-cart-proof":cartId},
      })],
      ["guest downgrade",()=>review(quote,{headers:{"x-shqipshop-cart-proof":cartId}})],
      ["forged authorization",()=>review(quote,{token:"bad_ci_jwt_token"})],
      ["wrong tenant",()=>review(quote,{token:owner.token,headers:{"x-shqipshop-tenant-id":"merchant_other"}})],
      ["foreign acceptance",()=>accept(quote,{token:stranger.token})],
      ["guest acceptance with capability",()=>accept(quote,{
        headers:{"x-shqipshop-cart-proof":cartId},
      })],
      ["user-substituted total",()=>accept(quote,{token:owner.token,body:{
        quote_id:quote.id,fingerprint:quote.fingerprint,total:"0",
      }})],
      ["wrong fingerprint",()=>accept(quote,{token:owner.token,body:{
        quote_id:quote.id,fingerprint:"sha256:"+"f".repeat(64),
      }})],
      ["cookie without CSRF",()=>accept(quote,{token:owner.token,headers:{cookie:"connect.sid=fake_ci"}})],
    ]){
      expectDenied(await fn(),label)
    }
    const raced=await Promise.all([
      accept(quote,{token:owner.token}),
      accept(quote,{token:owner.token}),
    ])
    assert.equal(raced.filter(r=>r.status===200).length,1,
      "Exactly one registered owner HTTP acceptance must win")
    assert.equal(raced.filter(r=>r.status===409).length,1)
    assert.equal((await accept(quote,{token:owner.token})).status,409)
    console.log("SHQIPSHOP_F07G_REAL_REGISTERED_HTTP_OWNER_QUOTE_REVIEW_ACCEPT_ONE_WINNER")
    console.log("SHQIPSHOP_F07G_REAL_REGISTERED_HTTP_FOREIGN_PRINCIPAL_AND_DOWNGRADE_DENIED")
  }else{
    assert.equal((await review(staleQuote,{token:owner.token})).status,409,
      "Repriced registered quote review must be stale")
    assert.equal((await accept(staleQuote,{token:owner.token})).status,409,
      "Repriced registered quote acceptance must be denied")
    assert.equal((await accept(quote,{token:owner.token})).status,409,
      "Previously accepted registered quote cannot be replayed")
    console.log("SHQIPSHOP_F07G_REAL_REGISTERED_HTTP_REPRICE_STALE_409")
  }
}
