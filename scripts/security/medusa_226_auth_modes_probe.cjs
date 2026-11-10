"use strict";
/**
 * Stage 12AB — REAL HTTP credential-mode and tenant-identity classification
 * on the disposable Medusa 2.22.6 AOF instance (:9003).
 *
 * This is deliberately NOT a comprehensive route-auth/CSRF/PSP audit.
 * Do not log tokens, cookies, emails, payloads, or synthetic IDs.
 * No production or checked-in Medusa dependency changes.
 */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {randomBytes}=require("node:crypto");
let phase="PREFLIGHT";
const env=process.env;
for(const [k,v] of Object.entries({
  CI:"true",NODE_ENV:"development",SHQIPSHOP_MEDUSA_CANDIDATE_CI:"true",
  SHQIPSHOP_REQUIRE_REDIS:"true",REDIS_URL:"redis://127.0.0.1:6379",
}))assert.equal(env[k],v,"Stage12AB exact disposable CI scope");
assert(/^[0-9]+$/.test(env.GITHUB_RUN_ID??""));
const temp=fs.realpathSync(env.RUNNER_TEMP);
const candidate=fs.realpathSync(env.SHQIPSHOP_MEDUSA_CANDIDATE_DIR);
const fixture=fs.realpathSync(env.SHQIPSHOP_CI_SESSION_PROOF_FILE);
for(const child of [candidate,fixture]){
 const rel=path.relative(temp,child);
 assert(rel && rel!==".." && !rel.startsWith(".."+path.sep) &&
   !path.isAbsolute(rel),"Runner-local synthetic fixture required");
}
const manifest=JSON.parse(fs.readFileSync(path.join(candidate,"apps/backend/package.json"),"utf8"));
assert.equal(manifest.dependencies["@medusajs/medusa"],"2.22.6");
const proof=JSON.parse(fs.readFileSync(fixture,"utf8"));
for(const tenant of ["A","B"]){
 assert(proof[tenant]?.key?.length>10);
 for(const actor of ["customer","admin"]){
  assert(proof[tenant][actor]?.id);
  assert(proof[tenant][actor]?.cookie?.startsWith("connect.sid="));
 }
}
const url=p=>"http://127.0.0.1:9003"+p;
const forbidden=s=>{
 for(const merchant of ["A","B"])for(const actor of ["admin","customer"]){
  const id=proof[merchant][actor].id;
  if(typeof id==="string"&&s.includes(id))return true;
 }
 return false;
};
async function call(port,method,route,headers={},body){
 const response=await fetch("http://127.0.0.1:"+port+route,{
  method,headers,body,redirect:"manual",signal:AbortSignal.timeout(12000),
 });
 const raw=await response.text();
 if(response.status>=400)assert(!forbidden(raw),
  "Protected synthetic identifier disclosed in an unsuccessful HTTP response");
 let data={};
 try{data=JSON.parse(raw)}catch{}
 return {status:response.status,data,headers:response.headers};
}
function identityHeaders(actor,mode,tenant="A"){
 const p=proof[tenant];
 const headers=actor==="customer"?{"x-publishable-api-key":proof.A.key}:{};
 if(mode==="cookie")headers.cookie=p[actor].cookie;
 if(mode==="token")headers.authorization="Bearer "+tokens[tenant][actor];
 if(mode==="invalid")headers.authorization="Bearer invalid-stage12ab-token";
 return headers;
}
const tokens={A:{},B:{}};
const credentials={
 A:{customer:["shopper-a@shqipshop.example.invalid","SHQIPSHOP_A_CUSTOMER_PASSWORD"],
    admin:["admin-a@shqipshop.example.invalid","SHQIPSHOP_A_ADMIN_PASSWORD"]},
 B:{customer:["shopper-b@shqipshop.example.invalid","SHQIPSHOP_B_CUSTOMER_PASSWORD"],
    admin:["admin-b@shqipshop.example.invalid","SHQIPSHOP_B_ADMIN_PASSWORD"]},
};
function denied(status,label){
 assert([401,403].includes(status),label+": failed credential-mode isolation");
}
async function login(tenant,actor){
 const port=tenant==="A"?9003:9001;
 const [email,secretKey]=credentials[tenant][actor];
 const password=env[secretKey];
 assert(password&&password.length>24,"Synthetic login secret unavailable");
 const role=actor==="admin"?"user":"customer";
 const r=await call(port,"POST","/auth/"+role+"/emailpass",
  {"content-type":"application/json"},JSON.stringify({email,password}));
 assert.equal(r.status,200,"Synthetic bearer login failed");
 assert(typeof r.data.token==="string"&&r.data.token.length>20);
 tokens[tenant][actor]=r.data.token;
 const sess=await call(port,"POST","/auth/session",
  {authorization:"Bearer "+r.data.token});
 assert.equal(sess.status,200,"Synthetic bearer-to-cookie exchange failed");
 assert((sess.headers.getSetCookie?.()??[]).some(x=>x.startsWith("connect.sid=")),
  "Actual Medusa session cookie was not issued");
}
async function readRole(actor,route,responseKey,expectedId){
 const correct=identityHeaders(actor,"cookie");
 const bearer=identityHeaders(actor,"token");
 const wrongActor=actor==="customer"?"admin":"customer";
 const statuses={};
 for(const [label,headers] of [
  ["cookie",correct],["bearer",bearer],
  ["missing",identityHeaders(actor,"none")],
  ["invalid",identityHeaders(actor,"invalid")],
  ["wrongRole",identityHeaders(wrongActor,"cookie")],
  ["foreignMerchant",identityHeaders(actor,"cookie","B")],
  ["foreignBearer",identityHeaders(actor,"token","B")],
 ]){
  const withKey=actor==="customer"?
   {...headers,"x-publishable-api-key":proof.A.key}:headers;
  const r=await call(9003,"GET",route,withKey);
  statuses[label]=r.status;
  if(label==="cookie"||label==="bearer"){
   assert.equal(r.status,200,"Expected real "+actor+" "+label+" authenticated GET");
   assert.equal(r.data[responseKey]?.id,expectedId,
    "Authorized response matched wrong tenant or user");
  }else denied(r.status,actor+" GET "+label);
 }
 console.log("SHQIPSHOP_226_STAGE12AB_"+actor.toUpperCase()+
  "_GET_SESSION_BEARER_TENANT_ROLE_CLASS",JSON.stringify(statuses));
}
async function adminOrders(){
 const route="/admin/orders?limit=1";
 const statuses={};
 for(const [label,h] of [
  ["adminCookie",identityHeaders("admin","cookie")],
  ["adminBearer",identityHeaders("admin","token")],
  ["noAuth",{}],
  ["customerCookie",identityHeaders("customer","cookie")],
  ["foreignAdminCookie",identityHeaders("admin","cookie","B")],
 ]){
  const r=await call(9003,"GET",route,h);
  statuses[label]=r.status;
  if(label==="adminCookie"||label==="adminBearer"){
   assert.equal(r.status,200,"Real Admin order listing denied correct credential");
   assert(Array.isArray(r.data.orders),"Real Admin order list shape unexpected");
  }else denied(r.status,"Admin order listing "+label);
 }
 console.log("SHQIPSHOP_226_STAGE12AB_ADMIN_ORDERS_READ_CLASS",JSON.stringify(statuses));
}
async function publicStore(){
 const response=await call(9003,"GET","/store/products?limit=1",
  {"x-publishable-api-key":proof.A.key});
 assert.equal(response.status,200,"Public catalog with publishable key failed");
 assert(Array.isArray(response.data.products),"Public catalog result shape unexpected");
 const noKey=await call(9003,"GET","/store/products?limit=1");
 // Depending on Medusa's public-key policy the no-key GET can be public
 // or denied. Record this separately; 200 is not an auth bypass.
 assert([200,400,401,403].includes(noKey.status));
 console.log("SHQIPSHOP_226_STAGE12AB_PUBLIC_STORE_PRODUCTS_CLASS",JSON.stringify({
  publishableKeyWithoutSession:response.status,
  noKeyWithoutSession:noKey.status,
  catalogUnauthenticatedWithPublishableKey:true,
 }));
}
async function sessionNegatives(){
 const statuses={};
 for(const [label,h] of [
  ["noBearer",{}],
  ["invalidBearer",{authorization:"Bearer invalid-stage12ab"}],
  ["foreignCustomerBearer",{authorization:"Bearer "+tokens.B.customer}],
  ["foreignAdminBearer",{authorization:"Bearer "+tokens.B.admin}],
 ]){
  const r=await call(9003,"POST","/auth/session",h);
  statuses[label]=r.status;
  denied(r.status,"Medusa session creation "+label);
  assert.equal((r.headers.getSetCookie?.()??[]).some(s=>s.startsWith("connect.sid=")),
    false,"Invalid session issued real signed cookie");
 }
 console.log("SHQIPSHOP_226_STAGE12AB_SESSION_EXCHANGE_NEGATIVES",JSON.stringify(statuses));
}
const routes=[
 {actor:"customer",route:"/store/customers/me",responseKey:"customer",
  read:"/store/customers/me",prop:"first_name",origin:"http://localhost:8000"},
 {actor:"admin",route:"/admin/customers/"+encodeURIComponent(proof.A.customer.id),
  responseKey:"customer",
  read:"/admin/customers/"+encodeURIComponent(proof.A.customer.id),
  prop:"last_name",origin:"http://localhost:9000"},
];
async function snapshot(p){
 const r=await call(9003,"GET",p.read,identityHeaders(p.actor,"cookie"));
 assert.equal(r.status,200,"Authorized synthetic profile snapshot GET failed");
 const row=r.data[p.responseKey];
 assert.equal(row?.id,proof.A.customer.id,"Wrong tenant profile snapshot");
 assert.equal(typeof row[p.prop],"string","Synthetic profile field missing");
 return row[p.prop];
}
async function mutation(p,mode,newValue,origin){
 const headers={
  ...identityHeaders(p.actor,mode),
  "content-type":"application/json",
  ...(origin?{origin,"sec-fetch-site":"same-origin"}:{}),
 };
 return call(9003,"POST",p.route,headers,JSON.stringify({[p.prop]:newValue}));
}
async function mutationBoundary(p){
 const original=await snapshot(p);
 const newName="CI-12AB-BEARER-"+randomBytes(6).toString("hex");
 const negative="CI-12AB-NO-WRITE-"+randomBytes(5).toString("hex");
 let positiveReached=false;
 try{
  const yes=await mutation(p,"token",newName);
  assert.equal(yes.status,200,"Authenticated bearer mutation unexpectedly rejected");
  positiveReached=true;
  assert.equal(await snapshot(p),newName,"Bearer mutation not persisted");
  const statuses={bearer:yes.status};
  for(const [label,mode,tenant] of [
   ["noAuth","none",null],
   ["wrongRole","wrong",null],
   ["foreignMerchant","foreign",null],
  ]){
   let headers={"content-type":"application/json",origin:p.origin,
    "sec-fetch-site":"same-origin"};
   if(p.actor==="customer")
     headers["x-publishable-api-key"]=proof.A.key;
   if(mode==="wrong")
     headers.cookie=proof.A[p.actor==="customer"?"admin":"customer"].cookie;
   if(mode==="foreign")
     headers.cookie=proof.B[p.actor].cookie;
   const r=await call(9003,"POST",p.route,headers,JSON.stringify({[p.prop]:negative}));
   statuses[label]=r.status;
   denied(r.status,p.actor+" mutation "+label);
   assert.equal(await snapshot(p),newName,"Denied mutation changed synthetic data");
  }
  console.log("SHQIPSHOP_226_STAGE12AB_"+p.actor.toUpperCase()+
   "_BEARER_WRITE_COOKIE_ROLE_NEGATIVE_CLASS",JSON.stringify(statuses));
 }finally{
  if(positiveReached){
   const restored=await mutation(p,"cookie",original,p.origin);
   assert.equal(restored.status,200,"Synthetic cookie profile restore failed");
   assert.equal(await snapshot(p),original,"Synthetic mutation was not restored");
  }
 }
}
async function bHealthy(){
 for(const actor of ["customer","admin"]){
  const r=await call(9001,"GET",
   actor==="customer"?"/store/customers/me":"/admin/users/me",
   {cookie:proof.B[actor].cookie,...(actor==="customer"?
    {"x-publishable-api-key":proof.B.key}:{})});
  assert.equal(r.status,200,"Tenant B own endpoint affected by A probe");
  assert.equal(r.data[actor==="customer"?"customer":"user"]?.id,
   proof.B[actor].id,"Tenant B identity changed");
 }
}
async function main(){
 phase="HEALTH";
 await bHealthy();
 phase="LOGIN";
 for(const tenant of ["A","B"])for(const actor of ["customer","admin"])
  await login(tenant,actor);
 phase="AUTH_SESSION_NEGATIVES";
 await sessionNegatives();
 phase="IDENTITY";
 await readRole("customer","/store/customers/me","customer",proof.A.customer.id);
 await readRole("admin","/admin/users/me","user",proof.A.admin.id);
 phase="ADMIN_CUSTOMER";
 // This is built-in Medusa routing, not the Stage12X POST middleware.
 for(const mode of ["cookie","token"]){
  const r=await call(9003,"GET","/admin/customers/"+
   encodeURIComponent(proof.A.customer.id),identityHeaders("admin",mode));
  assert.equal(r.status,200,"Admin customer detail read denied to "+mode);
  assert.equal(r.data.customer?.id,proof.A.customer.id);
 }
 phase="READ_ORDER_AND_PUBLIC";
 await adminOrders();
 await publicStore();
 phase="CUSTOMER_MUTATION";
 await mutationBoundary(routes[0]);
 phase="ADMIN_MUTATION";
 await mutationBoundary(routes[1]);
 phase="TENANT_B_HEALTH";
 await bHealthy();
 console.log("SHQIPSHOP_226_STAGE12AB_REAL_HTTP_MODES_AND_TENANT_NEGATIVES_PASSED");
 console.log("SHQIPSHOP_226_STAGE12AB_SELECTED_ROUTES_ONLY_NO_GLOBAL_CSRF_OR_PRODUCTION_CERTIFICATION");
}
main().catch(()=>{
 console.error("::error::SHQIPSHOP_226_STAGE12AB_FAILED_AT_"+phase);
 process.exitCode=1;
});
