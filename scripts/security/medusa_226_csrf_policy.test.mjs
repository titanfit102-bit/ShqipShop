"use strict";
/**
 * Stage 12X independent policy-unit checks. Node 24 strips types from the
 * exact checked-in TS module; no mock HTTP stack or Medusa package required.
 * Real Medusa mutation/read-back assertions remain a separate CI gate.
 */
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { enforceStage12xCookieCsrfCi as gate } from
  "../../medusa-backend-poc/apps/backend/src/api/middlewares/stage12x-cookie-csrf-ci.ts";

const keys=[
  "CI","NODE_ENV","SHQIPSHOP_MEDUSA_CANDIDATE_CI",
  "SHQIPSHOP_REQUIRE_REDIS","GITHUB_RUN_ID","REDIS_URL",
  "STORE_CORS","ADMIN_CORS",
];
const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
before(()=>{
  Object.assign(process.env,{
    CI:"true",NODE_ENV:"development",
    SHQIPSHOP_MEDUSA_CANDIDATE_CI:"true",SHQIPSHOP_REQUIRE_REDIS:"true",
    GITHUB_RUN_ID:"12345678",REDIS_URL:"redis://127.0.0.1:6382",
    STORE_CORS:"http://localhost:8000",ADMIN_CORS:"http://localhost:9000",
  });
});
after(()=>{
  for(const key of keys){
    if(saved[key]===undefined)delete process.env[key];
    else process.env[key]=saved[key];
  }
});
function check(options={}){
  const method=options.method??"POST";
  const path=options.path??"/store/customers/me";
  const headers={
    cookie:"connect.sid=synthetic-ci",
    origin:path.startsWith("/admin/")?"http://localhost:9000":"http://localhost:8000",
    "sec-fetch-site":"same-site",
    "content-type":"application/json",
    ...(options.headers??{}),
  };
  if(options.noOrigin)delete headers.origin;
  if(options.noCookie)delete headers.cookie;
  const req={method,path,originalUrl:path,headers};
  let passes=0,denied=0;
  const res={sendStatus(code){denied=code;return res;}};
  gate(req,res,()=>{passes++;});
  assert(passes===1&&denied===0 || passes===0&&denied===403,
    "Unexpected dispatch outcome");
  return passes===1?"NEXT":"403";
}
test("trusted customer/Admin profile, product and region JSON cookie writes pass",()=>{
  assert.equal(check(),"NEXT");
  assert.equal(check({path:"/admin/customers/cus_synthetic"}),"NEXT");
  assert.equal(check({path:"/admin/products/prod_synthetic"}),"NEXT");
  assert.equal(check({path:"/admin/regions/reg_synthetic"}),"NEXT");
});
test("external/missing/null origins fail closed on profiles, product and region",()=>{
  for(const path of ["/store/customers/me",
      "/admin/customers/cus_synthetic","/admin/products/prod_synthetic",
      "/admin/regions/reg_synthetic"]){
    assert.equal(check({path,headers:{origin:"https://external.example.invalid"}}),"403");
    assert.equal(check({path,noOrigin:true}),"403");
    assert.equal(check({path,headers:{origin:"null"}}),"403");
  }
});
test("form, plain body and inconsistent Referer/Fetch Metadata are rejected",()=>{
  assert.equal(check({headers:{"content-type":"application/x-www-form-urlencoded"}}),"403");
  assert.equal(check({headers:{"content-type":"text/plain"}}),"403");
  assert.equal(check({headers:{"sec-fetch-site":"cross-site"}}),"403");
  assert.equal(check({headers:{referer:"https://external.example.invalid/"}}),"403");
  assert.equal(check({headers:{"content-type":"application/json; charset=utf-8"}}),"NEXT");
  const product="/admin/products/prod_synthetic";
  assert.equal(check({path:product,headers:{"content-type":"application/x-www-form-urlencoded"}}),"403");
  assert.equal(check({path:product,headers:{"sec-fetch-site":"cross-site"}}),"403");
  assert.equal(check({path:product,headers:{referer:"https://external.example.invalid/"}}),"403");
  assert.equal(check({path:product,headers:{"content-type":"application/json; charset=utf-8"}}),"NEXT");
  const region="/admin/regions/reg_synthetic";
  assert.equal(check({path:region,headers:{"content-type":"application/x-www-form-urlencoded"}}),"403");
  assert.equal(check({path:region,headers:{"sec-fetch-site":"cross-site"}}),"403");
  assert.equal(check({path:region,headers:{referer:"https://external.example.invalid/"}}),"403");
  assert.equal(check({path:region,headers:{"content-type":"application/json; charset=utf-8"}}),"NEXT");
});
test("foreign cookie DELETE cannot reach the scoped customer/Admin handler",()=>{
  assert.equal(check({method:"DELETE",headers:{origin:"https://external.example.invalid"}}),"403");
  assert.equal(check({method:"DELETE",path:"/admin/customers/cus_synthetic",
    headers:{origin:"https://external.example.invalid"}}),"403");
});
test("Stage12AE/AG product and region matchers are POST-only and exact",()=>{
  assert.equal(check({path:"/admin/products/prod_synthetic",method:"GET",
    headers:{origin:"https://external.example.invalid"}}),"NEXT");
  assert.equal(check({path:"/admin/products/prod_synthetic",method:"DELETE",
    headers:{origin:"https://external.example.invalid"}}),"NEXT");
  assert.equal(check({path:"/admin/products",headers:{origin:"https://external.example.invalid"}}),"NEXT");
  assert.equal(check({path:"/admin/products/prod_synthetic/variants/var_test",
    headers:{origin:"https://external.example.invalid"}}),"NEXT");
  for(const method of ["GET","PUT","PATCH","DELETE"]){
    assert.equal(check({path:"/admin/regions/reg_synthetic",method,
      headers:{origin:"https://external.example.invalid"}}),"NEXT");
  }
  for(const path of ["/admin/regions","/admin/regions/reg_synthetic/payment-providers",
      "/admin/regions/reg_synthetic/fulfillment-providers"]){
    assert.equal(check({path,headers:{origin:"https://external.example.invalid"}}),"NEXT");
  }
  assert.equal(check({path:"/admin/customers/cus_synthetic",method:"GET",
    headers:{origin:"https://external.example.invalid"}}),"NEXT");
});
test("out-of-scope requests and all non-CI traffic remain untouched",()=>{
  assert.equal(check({noCookie:true}),"NEXT");
  assert.equal(check({path:"/admin/products/prod_synthetic",noCookie:true,
    headers:{origin:"https://external.example.invalid"}}),"NEXT");
  assert.equal(check({path:"/admin/regions/reg_synthetic",noCookie:true,
    headers:{origin:"https://external.example.invalid"}}),"NEXT");
  assert.equal(check({method:"GET"}),"NEXT");
  assert.equal(check({path:"/store/carts/cart_synthetic"}),"NEXT");
  process.env.REDIS_URL="redis://127.0.0.1:6379";
  assert.equal(check({headers:{origin:"https://external.example.invalid"}}),"NEXT");
  assert.equal(check({path:"/admin/products/prod_synthetic",
    headers:{origin:"https://external.example.invalid"}}),"NEXT");
  assert.equal(check({path:"/admin/regions/reg_synthetic",
    headers:{origin:"https://external.example.invalid"}}),"NEXT");
  process.env.REDIS_URL="redis://127.0.0.1:6382";
  process.env.SHQIPSHOP_MEDUSA_CANDIDATE_CI="false";
  assert.equal(check({headers:{origin:"https://external.example.invalid"}}),"NEXT");
  assert.equal(check({path:"/admin/products/prod_synthetic",
    headers:{origin:"https://external.example.invalid"}}),"NEXT");
  assert.equal(check({path:"/admin/regions/reg_synthetic",
    headers:{origin:"https://external.example.invalid"}}),"NEXT");
  process.env.SHQIPSHOP_MEDUSA_CANDIDATE_CI="true";
});
console.log("SHQIPSHOP_226_STAGE12X_UNIT_ONLY_NOT_BROWSER_OR_PRODUCTION_PROOF");
