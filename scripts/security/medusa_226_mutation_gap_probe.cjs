"use strict";
/**
 * Stage12AC: selected, real Medusa 2.22.6 admin product + guest-cart writes
 * outside Stage12X's two-route CSRF guard. Direct PostgreSQL readback and
 * guaranteed try/finally restore. Runner-local synthetic data only.
 *
 * This direct HTTP client supplies Cookie manually. Origin classification
 * alone is NOT proof of a browser-exploitable CSRF vulnerability.
 * Guest cart capability is NOT an authenticated customer-owned cart.
 * No secrets, emails, IDs or response bodies are logged.
 */
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const {execFileSync}=require("node:child_process"),{randomBytes}=require("node:crypto");
const e=process.env;let phase="SCOPE";
for(const [k,v] of Object.entries({CI:"true",NODE_ENV:"development",
 SHQIPSHOP_MEDUSA_CANDIDATE_CI:"true",SHQIPSHOP_REQUIRE_REDIS:"true",
 REDIS_URL:"redis://127.0.0.1:6379"}))assert.equal(e[k],v);
assert(/^[0-9]+$/.test(e.GITHUB_RUN_ID??""));
const temp=fs.realpathSync(e.RUNNER_TEMP);
function inside(file){
 const real=fs.realpathSync(file),rel=path.relative(temp,real);
 assert(rel&&rel!==".."&&!rel.startsWith(".."+path.sep)&&!path.isAbsolute(rel));
 return real;
}
const candidate=inside(e.SHQIPSHOP_MEDUSA_CANDIDATE_DIR);
const manifest=JSON.parse(fs.readFileSync(path.join(candidate,"apps/backend/package.json")));
assert.equal(manifest.dependencies["@medusajs/medusa"],"2.22.6");
const proof=JSON.parse(fs.readFileSync(inside(e.SHQIPSHOP_CI_SESSION_PROOF_FILE)));
assert(proof.A?.key?.length>10&&proof.B?.key?.length>10&&proof.A.key!==proof.B.key);
const db={};
for(const [merchant,name] of [["A","shqipshop_226_a"],["B","shqipshop_226_b"]]){
 const conn=e["SHQIPSHOP_STAGE12AC_DB_"+merchant],u=new URL(conn);
 assert.equal(u.protocol,"postgres:");assert.equal(u.hostname,"127.0.0.1");
 assert.equal(u.port,"5432");assert.equal(u.username,name);
 assert.equal(u.pathname,"/"+name);assert(u.password.length>8&&!u.search&&!u.hash);
 db[merchant]=conn;
}
function pg(tenant,table,column,id){
 assert((table==="product"&&column==="title"&&/^prod_[A-Za-z0-9_-]{8,}$/.test(id))||
   (table==="cart"&&column==="email"&&/^cart_[A-Za-z0-9_-]{8,}$/.test(id)));
 const query="SELECT COALESCE("+column+",'') FROM "+table+
   " WHERE id='"+id+"' AND deleted_at IS NULL";
 return execFileSync("psql",["-X","-A","-t","-v","ON_ERROR_STOP=1",
   "-d",db[tenant],"-c",query],{encoding:"utf8",timeout:12000,
   stdio:["ignore","pipe","ignore"]}).trim();
}
async function call(port,method,route,headers={},body){
 const res=await fetch("http://127.0.0.1:"+port+route,{method,headers,
  body:body===undefined?undefined:JSON.stringify(body),
  redirect:"manual",signal:AbortSignal.timeout(12000)});
 const raw=await res.text();
 let data={};try{data=JSON.parse(raw)}catch{}
 return {status:res.status,data,headers:res.headers};
}
const good={admin:"http://localhost:9000",store:"http://localhost:8000"};
const evil="https://attacker.bad-shop.test:9445";
const nonce=()=>randomBytes(5).toString("hex");
function headers(cookie,key,origin){
 return {"content-type":"application/json",...(cookie?{cookie}:{}),
  ...(key?{"x-publishable-api-key":key}:{}),
  ...(origin?{origin,"sec-fetch-site":origin===evil?"cross-site":"same-site"}:{})};
}
async function login(port,merchant,actor){
 const kind=actor==="admin"?"user":"customer";
 const email=(actor==="admin"?"admin-":"shopper-")+merchant.toLowerCase()+
   "@shqipshop.example.invalid";
 const password=e["SHQIPSHOP_"+merchant+"_"+actor.toUpperCase()+"_PASSWORD"];
 assert(password?.length>=24);
 const auth=await call(port,"POST","/auth/"+kind+"/emailpass",
  {"content-type":"application/json"},{email,password});
 assert.equal(auth.status,200,"Synthetic user login failed");
 assert(auth.data.token?.length>20);
 const session=await call(port,"POST","/auth/session",
  {authorization:"Bearer "+auth.data.token});
 assert.equal(session.status,200,"Medusa session minting failed");
 const c=(session.headers.getSetCookie?.()??[]).find(x=>x.startsWith("connect.sid="));
 assert(c?.length>40);
 return c.split(";")[0];
}
function denied(status,label){
 assert([401,403].includes(status),label+" auth isolation failed");
}
function classify(status,after,before,marker){
 if(status===200){assert.equal(after,marker,"200 not persisted");return "PERSISTED";}
 assert([400,401,403,404,405,415,422].includes(status),"Unexpected request status");
 assert.equal(after,before,"Rejected request changed DB");
 return "NO_CHANGE";
}
async function adminProduct(adminA,adminB,customerA){
 phase="ADMIN_PRODUCT_BASELINE";
 const res=await call(9003,"GET","/admin/products?limit=1",{cookie:adminA});
 assert.equal(res.status,200);assert(res.data.products?.length>0);
 const product=res.data.products[0],id=product.id;
 const original=pg("A","product","title",id);
 assert.equal(original,product.title);
 const b=await call(9001,"GET","/admin/products?limit=1",{cookie:adminB});
 assert.equal(b.status,200);assert(b.data.products?.length>0);
 const bid=b.data.products[0].id,beforeB=pg("B","product","title",bid);
 const trusted="CI-12AC-TRUSTED-"+nonce(),foreign="CI-12AC-FOREIGN-"+nonce();
 const update=(title,cookie,origin)=>call(9003,"POST",
  "/admin/products/"+encodeURIComponent(id),headers(cookie,null,origin),{title});
 try{
  phase="ADMIN_PRODUCT_TRUSTED";
  const positive=await update(trusted,adminA,good.admin);
  assert.equal(positive.status,200,"Admin product trusted POST failed");
  assert.equal(pg("A","product","title",id),trusted);
  phase="ADMIN_PRODUCT_NEGATIVES";
  const d={};
  for(const [label,c] of [["missing",null],["wrongRole",customerA],["merchantB",adminB]]){
   const result=await update(foreign,c,good.admin);
   d[label]=result.status;denied(result.status,label);
   assert.equal(pg("A","product","title",id),trusted);
  }
  phase="ADMIN_PRODUCT_ORIGIN";
  const hostile=await update(foreign,adminA,evil);
  const observed=pg("A","product","title",id);
  const status=classify(hostile.status,observed,trusted,foreign);
  assert.equal(hostile.status,403,"Stage12AE Admin product Origin gate absent");
  assert.equal(status,"NO_CHANGE","Stage12AE Admin product mutation persisted");
  console.log("SHQIPSHOP_226_STAGE12AE_ADMIN_PRODUCT_DIRECT_HTTP_403_NO_SQL_CHANGE");
  assert.equal(pg("B","product","title",bid),beforeB,"B product mutated");
  console.log("SHQIPSHOP_226_STAGE12AC_ADMIN_PRODUCT_CLASS",JSON.stringify({
   trusted:positive.status,missing:d.missing,wrongRole:d.wrongRole,
   foreignMerchant:d.merchantB,foreignOriginHttp:hostile.status,
   foreignOriginPersistence:status,browserExploitVerified:false,
  }));
 }finally{
  phase="ADMIN_PRODUCT_RESTORE";
  if(pg("A","product","title",id)!==original){
   const restored=await update(original,adminA,good.admin);
   assert.equal(restored.status,200,"Admin product restore rejected");
  }
  assert.equal(pg("A","product","title",id),original,"Admin product restore missing");
  assert.equal(pg("B","product","title",bid),beforeB);
 }
}
async function guestCart(customerA,adminB){
 phase="CART_CREATE";
 const regions=await call(9003,"GET","/store/regions",
  {"x-publishable-api-key":proof.A.key});
 assert.equal(regions.status,200);
 const region=regions.data.regions?.find(x=>x.name==="Shqipëri"&&x.currency_code==="all");
 assert(region?.id);
 const created=await call(9003,"POST","/store/carts",
  headers(null,proof.A.key,good.store),{region_id:region.id});
 assert.equal(created.status,200,"Guest cart creation rejected");
 const id=created.data.cart?.id;
 assert(/^cart_[A-Za-z0-9_-]{8,}$/.test(id));
 const original="ci12ac-base-"+nonce()+"@example.invalid";
 const trusted="ci12ac-own-"+nonce()+"@example.invalid";
 const foreign="ci12ac-external-"+nonce()+"@example.invalid";
 const forbidden="ci12ac-denied-"+nonce()+"@example.invalid";
 const update=(email,options={})=>call(9003,"POST",
  "/store/carts/"+encodeURIComponent(id),
  headers(options.cookie,options.key===undefined?proof.A.key:options.key,
    options.origin??good.store),{email});
 let baselineSet=false;
 try{
  phase="CART_BASELINE";
  const init=await update(original);
  assert.equal(init.status,200);baselineSet=true;
  assert.equal(pg("A","cart","email",id),original);
  phase="CART_TRUSTED";
  const legit=await update(trusted);
  assert.equal(legit.status,200);
  assert.equal(pg("A","cart","email",id),trusted);
  phase="CART_KEY_NEGATIVE";
  const empty=await update(forbidden,{key:null});
  assert([400,401,403].includes(empty.status),"Missing public key accepted");
  const bKey=await update(forbidden,{key:proof.B.key,cookie:adminB});
  assert([400,401,403].includes(bKey.status),"Foreign public key accepted");
  assert.equal(pg("A","cart","email",id),trusted);
  phase="CART_FOREIGN_ORIGIN";
  const hostile=await update(foreign,{cookie:customerA,origin:evil});
  const cls=classify(hostile.status,pg("A","cart","email",id),trusted,foreign);
  console.log("SHQIPSHOP_226_STAGE12AC_GUEST_CART_CLASS",JSON.stringify({
    trusted:legit.status,noKey:empty.status,foreignKey:bKey.status,
    foreignOriginWithCustomerCookie:hostile.status,persistence:cls,
    guestCartIdPossession:true,ownerAuthorizationVerified:false,
    browserExploitVerified:false,
  }));
 }finally{
  phase="CART_RESTORE";
  if(baselineSet&&pg("A","cart","email",id)!==original){
   const restored=await update(original);
   assert.equal(restored.status,200,"Guest cart restore failed");
  }
  if(baselineSet)assert.equal(pg("A","cart","email",id),original);
  // Only disposable CI database contains this guest cart; no PSP/order.
 }
}
async function main(){
 phase="FRESH_AUTH";
 const adminA=await login(9003,"A","admin");
 const adminB=await login(9001,"B","admin");
 const customerA=await login(9003,"A","customer");
 await adminProduct(adminA,adminB,customerA);
 await guestCart(customerA,adminB);
 const a=await call(9003,"GET","/health"),b=await call(9001,"GET","/health");
 assert.equal(a.status,200);assert.equal(b.status,200);
 console.log("SHQIPSHOP_226_STAGE12AC_DIRECT_HTTP_POSTGRES_CLASSIFICATION_COMPLETE");
 console.log("SHQIPSHOP_226_STAGE12AC_NOT_BROWSER_CSRF_OR_PRODUCTION_CERTIFICATION");
}
main().catch(()=>{
 console.error("::error::SHQIPSHOP_226_STAGE12AC_FAILED_AT_"+phase);
 process.exitCode=1;
});