"use strict";
/**
 * Stage 12W: CI-only HTTP characterization of cookie-authenticated Medusa
 * customer/Admin mutations versus trusted/foreign Origin, CORS preflight,
 * Fetch Metadata and browser-simple POST bodies.
 *
 * This HTTP client manually supplies cookies; it CANNOT demonstrate that a
 * browser will attach them cross-site. An HTTP 200 for a crafted cross-origin
 * request is not automatically a browser CSRF exploit. No production changes.
 */
const assert = require("node:assert/strict");
const { readFileSync, realpathSync } = require("node:fs");
const { join, relative, isAbsolute, sep } = require("node:path");
const { randomBytes } = require("node:crypto");

let phase="PREFLIGHT";
const env=process.env;
for (const [key,value] of Object.entries({
  CI:"true",NODE_ENV:"development",SHQIPSHOP_MEDUSA_CANDIDATE_CI:"true",
  SHQIPSHOP_REQUIRE_REDIS:"true",REDIS_URL:"redis://127.0.0.1:6379",
})) assert.equal(env[key],value,"Stage 12W disposable CI only");
assert(/^\d+$/.test(env.GITHUB_RUN_ID??""));
const temp=realpathSync(env.RUNNER_TEMP);
const candidate=realpathSync(env.SHQIPSHOP_MEDUSA_CANDIDATE_DIR);
const sessionProof=realpathSync(env.SHQIPSHOP_CI_SESSION_PROOF_FILE);
for (const path of [candidate,sessionProof]){
  const r=relative(temp,path);
  assert(r && r!==".." && !r.startsWith(".."+sep) && !isAbsolute(r),
    "Only synthetic runner-local artifacts are permitted");
}
const manifest=JSON.parse(readFileSync(join(candidate,"apps/backend/package.json"),"utf8"));
assert.equal(manifest.dependencies["@medusajs/medusa"],"2.22.6");
const proof=JSON.parse(readFileSync(sessionProof,"utf8"));
for (const tenant of ["A","B"]) {
  assert(proof[tenant]?.key?.length>10);
  for (const actor of ["customer","admin"])
    assert(proof[tenant][actor]?.id && proof[tenant][actor]?.cookie?.includes("connect.sid="));
}
const host="http://127.0.0.1:";
const originForeign="https://external.example.invalid";
const endpoints=[
  {name:"customer",method:"POST",path:"/store/customers/me",
   read:"/store/customers/me",responseKey:"customer",
   prop:"first_name",positiveOrigin:"http://localhost:8000",
   publishable:true},
  {name:"admin",method:"POST",
   path:"/admin/customers/"+encodeURIComponent(proof.A.customer.id),
   read:"/admin/customers/"+encodeURIComponent(proof.A.customer.id),
   responseKey:"customer",prop:"last_name",
   positiveOrigin:"http://localhost:9000",publishable:false},
];
function safeText(response) {
  return response.text().then(raw=>{
    // Never log private payload or cookies. Protect error paths too.
    for (const m of ["A","B"])for (const a of ["customer","admin"])
      assert(!raw.includes(proof[m][a].id)||response.status===200,
        "Private fixture ID leaked on unauthorized HTTP status");
    return raw;
  });
}
async function call(port,method,path,headers={},body,ms=7500){
  try {
    const response=await fetch(host+port+path,{
      method,headers,body,redirect:"manual",signal:AbortSignal.timeout(ms),
    });
    const raw=await safeText(response);
    let data={};try{data=JSON.parse(raw);}catch{}
    return {status:response.status,headers:response.headers,data};
  } catch(err) {
    // An unexpected network failure is not a security denial.
    throw new Error("Unexpected HTTP transport failure during CI CSRF probe");
  }
}
async function newCookie(actor){
  const kind=actor==="customer"?"customer":"user";
  const email=actor==="customer"?"shopper-a@shqipshop.example.invalid":"admin-a@shqipshop.example.invalid";
  const password=env[actor==="customer"?"SHQIPSHOP_A_CUSTOMER_PASSWORD":"SHQIPSHOP_A_ADMIN_PASSWORD"];
  assert(password?.length>=12);
  const login=await call(9003,"POST","/auth/"+kind+"/emailpass",
    {"content-type":"application/json"},JSON.stringify({email,password}));
  assert.equal(login.status,200,"Synthetic credential authentication failed");
  const token=login.data.token;
  assert(token?.length>20,"Synthetic JWT not returned");
  const session=await call(9003,"POST","/auth/session",{authorization:"Bearer "+token});
  assert.equal(session.status,200,"Synthetic cookie exchange failed");
  const cookieHeader=(session.headers.getSetCookie?.()??[])
    .find(x=>x.startsWith("connect.sid="));
  assert(cookieHeader,"Signed cookie missing");
  const cookie=cookieHeader.split(";")[0];
  assert(cookie.startsWith("connect.sid=")&&cookie.length>30);
  return {cookie,attributes:{
    httpOnly:/(?:^|;)\s*httponly(?:;|$)/i.test(cookieHeader),
    sameSite:/(?:^|;)\s*samesite=/i.test(cookieHeader),
    secure:/(?:^|;)\s*secure(?:;|$)/i.test(cookieHeader),
    explicitExpiry:/(?:^|;)\s*(?:expires|max-age)=/i.test(cookieHeader),
  }};
}
function authHeaders(actor,cookie) {
  return {cookie,...(actor==="customer"?
    {"x-publishable-api-key":proof.A.key}:{})};
}
async function profile(route,actor,cookie){
  const r=await call(9003,"GET",route.read,authHeaders(actor,cookie));
  assert.equal(r.status,200,"Synthetic authorized profile GET failed");
  const row=r.data[route.responseKey];
  assert.equal(row?.id,proof.A.customer.id,"Synthetic customer identity mismatch");
  assert(typeof row[route.prop]==="string"||row[route.prop]===null,
    "Synthetic profile snapshot missing expected field");
  return {id:row.id,value:row[route.prop]};
}
async function bHealthy(){
  for(const actor of ["customer","admin"]){
    const path=actor==="customer"?"/store/customers/me":"/admin/users/me";
    const headers={cookie:proof.B[actor].cookie,...(actor==="customer"?
      {"x-publishable-api-key":proof.B.key}:{})};
    const r=await call(9001,"GET",path,headers);
    assert.equal(r.status,200,"Merchant B lost session during CSRF classification");
    assert.equal(r.data[actor==="customer"?"customer":"user"]?.id,proof.B[actor].id,
      "Merchant B actor unexpectedly changed");
  }
}
async function modify(route,actor,cookie,body,options={}){
  const headers={
    ...authHeaders(actor,cookie),
    ...(options.origin?{origin:options.origin,referer:options.origin+"/probe"}:{}),
    ...(options.crossSite?{"sec-fetch-site":"cross-site",
      "sec-fetch-mode":"cors"}:{"sec-fetch-site":"same-origin"}),
    "content-type":options.type??"application/json",
  };
  const data=options.type==="application/x-www-form-urlencoded"?
    new URLSearchParams(body).toString():
    JSON.stringify(body);
  return call(9003,"POST",route.path,headers,data);
}
async function ensureUntouched(route,actor,cookie,baseline,label){
  const snapshot=await profile(route,actor,cookie);
  assert.equal(snapshot.value,baseline,label+": unexpected data mutation");
}
async function restore(route,actor,cookie,baseline){
  const updated=await modify(route,actor,cookie,{[route.prop]:baseline},
    {origin:route.positiveOrigin});
  assert.equal(updated.status,200,"Synthetic profile restore failed");
  await ensureUntouched(route,actor,cookie,baseline,"restore");
}
async function preflight(route,origin){
  const headers={
    origin,
    "access-control-request-method":"POST",
    "access-control-request-headers":
      route.publishable?"content-type,x-publishable-api-key":"content-type",
    "sec-fetch-mode":"cors","sec-fetch-site":origin===originForeign?
      "cross-site":"same-site",
  };
  const r=await call(9003,"OPTIONS",route.path,headers);
  const allowOrigin=r.headers.get("access-control-allow-origin");
  const allowCredentials=r.headers.get("access-control-allow-credentials")==="true";
  return {status:r.status,allowOrigin,allowCredentials};
}
async function execute(){
  phase="BASELINE";
  const customer=await newCookie("customer");
  const admin=await newCookie("admin");
  assert(customer.attributes.httpOnly&&admin.attributes.httpOnly,
    "Expected HttpOnly cookie attribute missing");
  console.log("SHQIPSHOP_226_STAGE12W_COOKIE_ATTRIBUTE_CLASS",JSON.stringify({
    customer:customer.attributes,admin:admin.attributes,
  }));
  await bHealthy();
  let originAccept=0,simpleBodyAccept=0;
  for(const route of endpoints){
    const actor=route.name;
    const cookie=actor==="customer"?customer.cookie:admin.cookie;
    const wrongActorCookie=actor==="customer"?admin.cookie:customer.cookie;
    phase="ROUTE_"+actor;
    const baseline=(await profile(route,actor,cookie)).value;
    assert(typeof baseline==="string","Only synthetic nonempty mutable names may be tested");

    // Proven legitimate same-site authenticated mutation, then restoration.
    const ownValue="CI-12W-OWN-"+randomBytes(5).toString("hex");
    const positive=await modify(route,actor,cookie,{[route.prop]:ownValue},
      {origin:route.positiveOrigin});
    assert.equal(positive.status,200,"Trusted-origin authenticated mutation failed");
    await ensureUntouched(route,actor,cookie,ownValue,"own positive update");
    await restore(route,actor,cookie,baseline);
    console.log("SHQIPSHOP_226_STAGE12W_"+actor.toUpperCase()+"_TRUSTED_COOKIE_MUTATION_PASSED");

    // True negative: no authentication, wrong role, foreign merchant cookie.
    for (const [label,credential] of [
      ["missing",undefined],["wrongRole",wrongActorCookie],
      ["foreign",proof.B[actor].cookie],
    ]){
      const headers={
        ...(credential?{cookie:credential}:{}),
        ...(route.publishable?{"x-publishable-api-key":proof.A.key}:{}),
        origin:route.positiveOrigin,"content-type":"application/json",
      };
      const r=await call(9003,"POST",route.path,headers,
        JSON.stringify({[route.prop]:"CI-MUST-NOT-WRITE"}));
      assert([401,403].includes(r.status),
        actor+" "+label+" cookie unexpectedly authorized mutation");
      await ensureUntouched(route,actor,cookie,baseline,"denied "+label);
    }
    console.log("SHQIPSHOP_226_STAGE12W_"+actor.toUpperCase()+"_NEGATIVE_COOKIE_ISOLATION_PASSED");

    // Check CORS preflight separately from server-side Origin handling.
    const trusted=await preflight(route,route.positiveOrigin);
    const foreign=await preflight(route,originForeign);
    assert.notEqual(foreign.allowOrigin,originForeign,
      "CORS reflected untrusted external origin");
    assert(!(foreign.allowOrigin==="*"&&foreign.allowCredentials),
      "Unsafe credentialed wildcard CORS combination");
    console.log("SHQIPSHOP_226_STAGE12W_"+actor.toUpperCase()+"_PREFLIGHT_CLASS",JSON.stringify({
      trustedAllowed:trusted.allowOrigin===route.positiveOrigin,
      foreignAllowed:false,
      foreignStatus:foreign.status,
    }));

    // THIS IS DIRECT HTTP (manual Cookie): not a real browser exploit.
    // It measures whether the server itself rejects foreign Origin / Fetch
    // Metadata when an otherwise valid authenticated JSON POST arrives.
    const foreignMarker="CI-12W-CROSS-"+randomBytes(5).toString("hex");
    try{
      const r=await modify(route,actor,cookie,{[route.prop]:foreignMarker},
        {origin:originForeign,crossSite:true});
      assert([200,400,401,403,404,405,415].includes(r.status),
        "Unexpected foreign-Origin mutation classification");
      const now=(await profile(route,actor,cookie)).value;
      const mutated=now===foreignMarker;
      if(mutated){
        assert.equal(r.status,200,"Foreign Origin mutated resource without HTTP 200");
        originAccept++;
      }else assert.equal(now,baseline,"Foreign Origin caused unexpected state change");
      console.log("SHQIPSHOP_226_STAGE12W_"+actor.toUpperCase()+"_FOREIGN_ORIGIN_HTTP_CLASS",JSON.stringify({
        httpStatus:r.status,serverMutation:mutated,browserExploitCertified:false,
      }));
    } finally {
      await restore(route,actor,cookie,baseline);
    }

    // Browser-simple text/plain is not preflighted. Test its parser/guard
    // separately; HTTP client deliberately supplies Cookie manually.
    phase="SIMPLE_BODY_"+actor;
    for(const type of ["text/plain","application/x-www-form-urlencoded"]){
      const marker="CI-12W-SIMPLE-"+randomBytes(5).toString("hex");
      const body={[route.prop]:marker};
      const h={
        ...authHeaders(actor,cookie),origin:originForeign,
        referer:originForeign+"/probe","sec-fetch-site":"cross-site",
        "content-type":type,
      };
      const serialized=type==="text/plain"?JSON.stringify(body):
        new URLSearchParams(body).toString();
      try {
        const r=await call(9003,"POST",route.path,h,serialized);
        assert([200,400,401,403,404,405,415,422].includes(r.status),
          "Unexpected browser-simple POST response");
        const after=(await profile(route,actor,cookie)).value;
        const changed=after===marker;
        if(changed){
          assert.equal(r.status,200);
          simpleBodyAccept++;
        } else assert.equal(after,baseline,"Simple form mutated unintended data");
        console.log("SHQIPSHOP_226_STAGE12W_"+actor.toUpperCase()+"_SIMPLE_BODY_CLASS",
          JSON.stringify({type,status:r.status,serverMutation:changed,
            browserExploitCertified:false}));
      } finally {
        await restore(route,actor,cookie,baseline);
      }
    }
    await bHealthy();
  }
  console.log("SHQIPSHOP_226_STAGE12W_SERVER_ORIGIN_AND_SIMPLE_BODY_SUMMARY",
    JSON.stringify({foreignOriginJsonMutationCount:originAccept,
      crossSiteSimpleMutationCount:simpleBodyAccept,
      corsExternalOriginDenied:true,browserExploitCertified:false}));
  console.log("SHQIPSHOP_226_STAGE12W_CI_ONLY_CSRF_POSTURE_NOT_PRODUCTION_CERTIFICATION");
  // A browser-simple application/x-www-form-urlencoded request can be sent
  // without CORS preflight. A manually supplied cookie is NOT proof a browser
  // sends that cookie cross-site, but an accepted authenticated mutation is
  // not a secure server-side CSRF boundary. Keep this candidate CI RED until
  // a separately authorized fix is implemented and independently verified.
  if(simpleBodyAccept!==0){
    phase="BROWSER_SIMPLE_COOKIE_MUTATION_SECURITY_GATE";
    console.error("::error::SHQIPSHOP_226_STAGE12W_UNTRUSTED_SIMPLE_FORM_MUTATED_COOKIE_SESSION");
    throw new Error("Stage12W classified unsafe cookie-origin boundary in disposable candidate");
  }
  console.log("SHQIPSHOP_226_STAGE12W_SIMPLE_FORM_COOKIE_BOUNDARY_DENIED");
}
execute().catch(()=>{
  console.error("::error::SHQIPSHOP_226_STAGE12W_FAILED_AT_"+phase);
  process.exitCode=1;
});
