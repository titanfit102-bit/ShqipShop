"use strict";
/**
 * Stages 12Y-12Z: browser-driven HTTPS cross-site cookie/CSRF classification.
 * Disposable GitHub CI only. Never logs session cookies, tokens, names or
 * passwords. Real Medusa 2.22.6 AOF instance (:9003) remains authoritative.
 * This is NOT a production HTTPS certificate or complete CSRF policy test.
 */
const assert = require("node:assert/strict");
const https = require("node:https");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { randomBytes } = require("node:crypto");

const env = process.env;
for (const [key,value] of Object.entries({
  CI:"true",NODE_ENV:"development",SHQIPSHOP_MEDUSA_CANDIDATE_CI:"true",
  SHQIPSHOP_REQUIRE_REDIS:"true",REDIS_URL:"redis://127.0.0.1:6379",
})) assert.equal(env[key],value,"Stage12Y exact disposable runner scope");
assert(/^[0-9]+$/.test(env.GITHUB_RUN_ID ?? ""));
const temp=fs.realpathSync(env.RUNNER_TEMP);
const candidate=fs.realpathSync(env.SHQIPSHOP_MEDUSA_CANDIDATE_DIR);
const sessionProof=fs.realpathSync(env.SHQIPSHOP_CI_SESSION_PROOF_FILE);
for(const p of [candidate,sessionProof]){
  const rel=path.relative(temp,p);
  assert(rel && rel!==".." && !rel.startsWith(".."+path.sep) &&
    !path.isAbsolute(rel),"Synthetic runner-local artifacts only");
}
const manifest=JSON.parse(fs.readFileSync(path.join(candidate,"apps/backend/package.json"),"utf8"));
assert.equal(manifest.dependencies["@medusajs/medusa"],"2.22.6");
const proof=JSON.parse(fs.readFileSync(sessionProof,"utf8"));
assert(proof.A?.key && proof.A?.customer?.id && proof.B?.customer?.id);
const browserRoot=fs.realpathSync(env.SHQIPSHOP_STAGE12Y_BROWSER_DIR);
const browserRelative=path.relative(temp,browserRoot);
assert(browserRelative && !browserRelative.startsWith("..") &&
  !path.isAbsolute(browserRelative));
const {chromium}=require(path.join(browserRoot,"node_modules","playwright-core"));
const chromeBin=env.SHQIPSHOP_STAGE12Y_CHROME_BIN;
assert(chromeBin && fs.existsSync(chromeBin),"A real installed Chromium/Chrome binary is required");
const API="https://api.shop-a.test:9443";
const SHOP="https://shop.shop-a.test:9444";
const EVIL="https://attacker.bad-shop.test:9445";
const ADMIN="https://admin.shop-a.test:9446";
const domains=["api.shop-a.test","shop.shop-a.test","attacker.bad-shop.test","admin.shop-a.test"];
const events=[];
const navigationEvents=[];
const stage12adEvents=[];
const instances=[];
let browser;
let phase="START";
let certDir;
const t=(port,host)=>({port,host});
const ports=[t(9443,domains[0]),t(9444,domains[1]),t(9445,domains[2]),t(9446,domains[3])];
function listen(s,port){
  return new Promise((resolve,reject)=>{
    s.once("error",reject);
    s.listen(port,"127.0.0.1",()=>{
      s.off("error",reject);
      resolve();
    });
  });
}
function closeServer(s){
  return new Promise(resolve=>s.close(()=>resolve()));
}
function issueCert() {
  certDir=fs.mkdtempSync(path.join(temp,"shqipshop-12y-tls-"));
  const key=path.join(certDir,"key.pem"),cert=path.join(certDir,"cert.pem");
  const p=spawnSync("openssl",["req","-x509","-newkey","rsa:2048","-nodes",
    "-days","1","-keyout",key,"-out",cert,"-subj","/CN=api.shop-a.test",
    "-addext","subjectAltName="+domains.map(d=>"DNS:"+d).join(",")],
    {stdio:"ignore",timeout:15000});
  assert.equal(p.status,0,"Disposable TLS fixture certificate creation failed");
  fs.chmodSync(key,0o600);
  return {key:fs.readFileSync(key),cert:fs.readFileSync(cert)};
}
function handler(host,req,res){
  if(req.headers.host !== host+":"+ports.find(p=>p.host===host).port){
    res.writeHead(421);res.end();return;
  }
  // Fixed, synthetic attacker-controlled redirect fixtures. Never accept
  // arbitrary target parameters or redirect outside the disposable API.
  const redirect=host==="attacker.bad-shop.test" && req.method==="POST" ?
    /^\/__stage12z\/redirect\/(302|307)\/(customer|admin)$/.exec(String(req.url??"")) : null;
  if(redirect){
    const target=redirect[2]==="admin" ?
      "/admin/customers/"+encodeURIComponent(proof.A.customer.id) : "/store/customers/me";
    res.writeHead(Number(redirect[1]),{
      location:API+target,"cache-control":"no-store",
    });
    res.end();
    return;
  }
  if(host!=="api.shop-a.test"){
    res.writeHead(200,{"content-type":"text/html; charset=utf-8",
      "cache-control":"no-store","x-content-type-options":"nosniff"});
    res.end("<!doctype html><html><head><title>Stage12Y disposable browser</title></head><body>CI</body></html>");
    return;
  }
  if(req.url==="/__stage12y/boot"){
    res.writeHead(200,{"content-type":"text/html; charset=utf-8",
      "cache-control":"no-store"});
    res.end("<!doctype html><html><body>Disposable API browser origin</body></html>");
    return;
  }
  const route=String(req.url??"").split("?")[0];
  const profileRoute=route==="/store/customers/me" ||
    /^\/admin\/customers\/[^/]+\/?$/.test(route);
  const observed=profileRoute && ["POST","GET"].includes(req.method)?{
    actor:route.startsWith("/admin/")?"admin":"customer",
    method:req.method,
    origin:typeof req.headers.origin==="string"?req.headers.origin:"ABSENT",
    fetchSite:typeof req.headers["sec-fetch-site"]==="string"?
      req.headers["sec-fetch-site"]:"ABSENT",
    hasCookie:typeof req.headers.cookie==="string" &&
      /(?:^|;\s*)connect\.sid=/.test(req.headers.cookie),
    type:String(req.headers["content-type"]??"").split(";")[0],
    status:0,
  }:null;
  // Stage12AD: inspect only scoped product/cart method+Origin+Cookie facts.
  // Never record body values, session tokens, publishable key, IDs or usernames.
  const isAdminProduct=/^\/admin\/products\/[^/]+\/?$/.test(route);
  const isAdminRegion=/^\/admin\/regions\/[^/]+\/?$/.test(route);
  const isGuestCart=/^\/store\/carts\/[^/]+\/?$/.test(route);
  const adObserved=(isAdminProduct||isAdminRegion||isGuestCart)&&["POST","OPTIONS"].includes(req.method)?{
    target:isAdminProduct?"admin-product":isAdminRegion?"admin-region":"guest-cart",
    method:req.method,
    origin:typeof req.headers.origin==="string"?req.headers.origin:"ABSENT",
    fetchSite:typeof req.headers["sec-fetch-site"]==="string"?
      req.headers["sec-fetch-site"]:"ABSENT",
    cookieSent:typeof req.headers.cookie==="string"&&
      /(?:^|;\s*)connect\.sid=/.test(req.headers.cookie),
    contentType:String(req.headers["content-type"]??"").split(";")[0],
    publicKeySent:typeof req.headers["x-publishable-api-key"]==="string",
    status:0,
  }:null;
  if(adObserved)stage12adEvents.push(adObserved);
  if(observed)navigationEvents.push(observed);
  const event=observed?.method==="POST"?observed:null;
  if(event)events.push(event);
  const out=http.request({
    hostname:"127.0.0.1",port:9003,method:req.method,path:req.url,
    headers:{...req.headers,host:"localhost:9003"},
    timeout:9000,
  },response=>{
    if(observed)observed.status=response.statusCode;
    if(adObserved)adObserved.status=response.statusCode;
    res.writeHead(response.statusCode??502,response.headers);
    response.pipe(res);
  });
  out.on("timeout",()=>out.destroy(new Error("Timeout")));
  out.on("error",()=>{
    if(!res.headersSent)res.writeHead(502);
    res.end();
  });
  req.pipe(out);
}
async function proxyServers(tls){
  for(const p of ports){
    const server=https.createServer(tls,(req,res)=>handler(p.host,req,res));
    instances.push(server);
    await listen(server,p.port);
  }
}
async function login(context,actor){
  const page=await context.newPage();
  await page.goto(API+"/__stage12y/boot",{waitUntil:"load"});
  const isAdmin=actor==="admin";
  const email=isAdmin?"admin-a@shqipshop.example.invalid":
    "shopper-a@shqipshop.example.invalid";
  const password=env[isAdmin?"SHQIPSHOP_A_ADMIN_PASSWORD":"SHQIPSHOP_A_CUSTOMER_PASSWORD"];
  assert(password && password.length>=12);
  const status=await page.evaluate(async data=>{
    const one=await fetch("/auth/"+data.actor+"/emailpass",{
      method:"POST",headers:{"content-type":"application/json"},
      body:JSON.stringify({email:data.email,password:data.password}),
    });
    if(one.status!==200)return {login:one.status,session:0};
    const json=await one.json();
    if(typeof json.token!=="string"||json.token.length<20)
      return {login:one.status,session:0};
    const two=await fetch("/auth/session",{
      method:"POST",headers:{authorization:"Bearer "+json.token},
    });
    return {login:one.status,session:two.status};
  },{actor:isAdmin?"user":"customer",email,password});
  assert.deepEqual(status,{login:200,session:200},"Browser login/session exchange failed");
  const cookies=await context.cookies(API);
  const c=cookies.find(x=>x.name==="connect.sid");
  assert(c && c.httpOnly && c.value.length>30,
    "Real browser session cookie missing or not HttpOnly");
  // Do not log the cookie, name, identity, JWT or content of the page.
  console.log("SHQIPSHOP_226_STAGE12Y_"+actor.toUpperCase()+
    "_BROWSER_SESSION_CLASS",JSON.stringify({
      httpOnly:c.httpOnly,secure:c.secure,sameSite:c.sameSite,
      hostOnly:!c.domain.startsWith("."),
    }));
  return page;
}
async function getProfile(page,actor){
  await page.goto(API+"/__stage12y/boot",{waitUntil:"load"});
  const isAdmin=actor==="admin";
  const route=isAdmin?"/admin/customers/"+encodeURIComponent(proof.A.customer.id):
    "/store/customers/me";
  const value=await page.evaluate(async data=>{
    const headers=data.key?{"x-publishable-api-key":data.key}:{};
    const r=await fetch(data.route,{headers,credentials:"include"});
    if(r.status!==200)return {status:r.status};
    const json=await r.json();
    const item=json.customer??{};
    return {status:r.status,id:item.id,
      val:item[data.field]};
  },{route,key:isAdmin?null:proof.A.key,
    field:isAdmin?"last_name":"first_name"});
  console.log("SHQIPSHOP_226_STAGE12Y_"+actor.toUpperCase()+
    "_PROFILE_HTTP_CLASS",JSON.stringify({httpStatus:value.status,
      identityMatches:value.id===proof.A.customer.id,
      fieldPresent:typeof value.val==="string"}));
  assert.equal(value.status,200,"Browser-owned profile GET failed");
  assert.equal(value.id,proof.A.customer.id,"Unexpected customer identity");
  assert.equal(typeof value.val,"string");
  return value.val;
}
async function trustedMutation(page,actor,value){
  const isAdmin=actor==="admin";
  const origin=isAdmin?ADMIN:SHOP;
  const route=isAdmin?"/admin/customers/"+encodeURIComponent(proof.A.customer.id):
    "/store/customers/me";
  const field=isAdmin?"last_name":"first_name";
  await page.goto(origin+"/",{waitUntil:"load"});
  const result=await page.evaluate(async data=>{
    const headers={"content-type":"application/json"};
    if(data.key)headers["x-publishable-api-key"]=data.key;
    const resp=await fetch(data.api+data.route,{
      method:"POST",credentials:"include",headers,
      body:JSON.stringify({[data.field]:data.value}),
    });
    return {status:resp.status};
  },{api:API,route,field,value,key:isAdmin?null:proof.A.key});
  console.log("SHQIPSHOP_226_STAGE12Y_"+actor.toUpperCase()+
    "_TRUSTED_POST_HTTP_CLASS",JSON.stringify({httpStatus:result.status}));
  assert.equal(result.status,200,"Browser trusted cross-origin mutation failed");
  const last=events.at(-1);
  assert(last && last.actor===actor && last.origin===origin &&
    last.hasCookie && last.status===200,
    "Trusted browser mutation did not use actual cookie or allowlisted Origin");
}
async function attackerForm(page,actor,marker,expectedCookie=false){
  const isAdmin=actor==="admin";
  const route=isAdmin?"/admin/customers/"+encodeURIComponent(proof.A.customer.id):
    "/store/customers/me";
  const field=isAdmin?"last_name":"first_name";
  const before=events.length;
  await page.goto(EVIL+"/",{waitUntil:"load"});
  const target=API+route;
  const responsePromise=page.waitForResponse(r=>
    r.url()===target && r.request().method()==="POST",{timeout:12000});
  await page.evaluate(data=>{
    const frame=document.createElement("iframe");
    frame.name="stage12y-frame";frame.style.display="none";
    document.body.appendChild(frame);
    const form=document.createElement("form");
    form.method="POST";form.action=data.target;form.target=frame.name;
    form.enctype="application/x-www-form-urlencoded";
    const input=document.createElement("input");
    input.name=data.field;input.value=data.marker;
    form.appendChild(input);document.body.appendChild(form);form.submit();
  },{target,field,marker});
  const result=await responsePromise;
  assert.equal(events.length,before+1,"Real browser form POST not observed");
  const recorded=events[before];
  assert(recorded.actor===actor &&
    recorded.origin===EVIL &&
    recorded.fetchSite==="cross-site" &&
    recorded.type==="application/x-www-form-urlencoded",
    "Browser did not transmit cross-site form metadata");
  assert([400,401,403].includes(result.status()),
    "Cross-site browser form unexpectedly succeeded");
  assert.equal(recorded.hasCookie,expectedCookie,
    "Browser cookie transmission differed from the controlled SameSite fixture");
  if(expectedCookie && actor==="admin")
    assert.equal(result.status(),403,
      "Authenticated cross-site Admin form did not hit the 403 server boundary");
  assert.equal(recorded.status,result.status(),
    "HTTPS proxy and real browser status mismatch");
  // Note whether the browser automatically delivered Cookie; a denied
  // request WITHOUT Cookie is NOT evidence of the server-side CSRF guard.
  console.log("SHQIPSHOP_226_STAGE12Y_"+actor.toUpperCase()+
    "_BROWSER_CROSS_SITE_FORM_CLASS",JSON.stringify({
      cookiePolicy:expectedCookie?"NONE_SECURE_BROWSER_FIXTURE":"SERVER_DEFAULT_LAX",
      cookieSent:recorded.hasCookie,httpStatus:result.status(),
      originMatched:true,fetchSiteCrossSite:true,serverMutation:false,
    }));
}
/**
 * A cross-site TOP-LEVEL browser navigation, not an iframe or a
 * manually-injected request Cookie. 302 converts browser POST to GET;
 * 307 preserves POST. Check the observed method independently to avoid
 * treating a successful 302 GET as a successful credentialed write.
 *
 * expectedCookie=true only for the deliberately configured browser cookie
 * fixture (SameSite=None; Secure). Server-default cookie inclusion is
 * deliberately classified rather than hardcoded: recent Chrome
 * default-Lax+POST navigation grace can differ from iframe behavior.
 */
async function topLevelNavigation(page,actor,kind,expectedCookie=false){
  assert(["direct","302","307"].includes(kind));
  const isAdmin=actor==="admin";
  const route=isAdmin?"/admin/customers/"+encodeURIComponent(proof.A.customer.id):
    "/store/customers/me";
  const target=API+route;
  const expectedMethod=kind==="302"?"GET":"POST";
  const start=navigationEvents.length;
  await page.goto(EVIL+"/",{waitUntil:"load"});
  const responsePromise=page.waitForResponse(r=>
    r.url()===target && r.request().method()===expectedMethod,
    {timeout:12000});
  await page.evaluate(data=>{
    const form=document.createElement("form");
    form.method="POST";
    form.enctype="application/x-www-form-urlencoded";
    form.action=data.action;
    const input=document.createElement("input");
    input.name=data.field;
    input.value=data.marker;
    form.appendChild(input);
    document.body.appendChild(form);
    form.submit(); // top-level navigation; no target/iframe
  },{
    action:kind==="direct"?target:
      EVIL+"/__stage12z/redirect/"+kind+"/"+actor,
    field:isAdmin?"last_name":"first_name",
    marker:"CI-12Z-NO-MUTATION-"+randomBytes(5).toString("hex"),
  });
  const response=await responsePromise;
  // A response's headers can arrive before Chromium commits the main-frame
  // navigation. Do not race a subsequent trusted profile read against an
  // unfinished top-level POST/redirect page load.
  await page.waitForURL(target,{waitUntil:"domcontentloaded",timeout:12000});
  const matches=navigationEvents.slice(start).filter(x=>x.actor===actor);
  assert.equal(matches.length,1,
    "Top-level browser request count differed from the intended target");
  const recorded=matches[0];
  assert.equal(recorded.method,expectedMethod,
    "Redirect unexpectedly changed the browser target method");
  assert.equal(recorded.status,response.status(),
    "Browser observed an HTTP status different from the HTTPS proxy");
  assert(["cross-site","same-site","same-origin","none"].includes(recorded.fetchSite),
    "Missing or unexpected Fetch Metadata on top-level navigation");
  if(expectedCookie)assert.equal(recorded.hasCookie,true,
    "SameSite=None; Secure fixture cookie was NOT sent on top-level navigation");
  if(expectedMethod==="POST"){
    assert([400,401,403].includes(response.status()),
      "Top-level browser cross-site POST was unexpectedly accepted");
    if(isAdmin && recorded.hasCookie)
      assert.equal(response.status(),403,
        "Authenticated Admin top-level cross-site POST bypassed the origin gate");
    if(isAdmin && !recorded.hasCookie)
      assert.equal(response.status(),401,
        "Unauthenticated Admin top-level cross-site POST unexpected response");
  }
  const originClass=recorded.origin===EVIL?"ATTACKER":
    recorded.origin==="null"?"NULL":
    recorded.origin==="ABSENT"?"ABSENT":"OTHER";
  assert.notEqual(originClass,"OTHER",
    "Top-level browser request carried an unclassified Origin");
  console.log("SHQIPSHOP_226_STAGE12Z_"+actor.toUpperCase()+
    "_TOP_LEVEL_NAV_CLASS",JSON.stringify({
      redirect:kind,cookiePolicy:expectedCookie?
        "NONE_SECURE_BROWSER_FIXTURE":"SERVER_DEFAULT_RECENT",
      method:recorded.method,cookieSent:recorded.hasCookie,
      originClass,fetchSite:recorded.fetchSite,
      httpStatus:response.status(),
    }));
}
async function runActor(actor,browser){
  const context=await browser.newContext({ignoreHTTPSErrors:true});
  try{
    const page=await login(context,actor);
    phase=actor.toUpperCase()+"_BASELINE_PROFILE";
    const before=await getProfile(page,actor);
    assert(before.length>0,"Only synthetic nonempty profile fixtures");
    const changed="CI-12Y-TRUSTED-"+randomBytes(5).toString("hex");
    try {
      phase=actor.toUpperCase()+"_TRUSTED_POST";
      await trustedMutation(page,actor,changed);
      phase=actor.toUpperCase()+"_TRUSTED_READBACK";
      assert.equal(await getProfile(page,actor),changed,
        "Trusted browser update not persisted in Medusa");
      phase=actor.toUpperCase()+"_CROSS_SITE_FORM";
      await attackerForm(page,actor,
        "CI-12Y-UNTRUSTED-"+randomBytes(5).toString("hex"));
      assert.equal(await getProfile(page,actor),changed,
        "Cross-site browser form unexpectedly modified profile");
      // Stage 12Z: top-level form navigation and browser redirects from
      // an attacker origin while the issued cookie remains unmodified.
      // Default-Lax browser grace may transmit recent cookies on top-level
      // POST; classify actual Cookie, never claim it was necessarily absent.
      for(const kind of ["direct","302","307"]){
        phase=actor.toUpperCase()+"_DEFAULT_TOP_LEVEL_"+kind;
        await topLevelNavigation(page,actor,kind);
        assert.equal(await getProfile(page,actor),changed,
          "Server-default top-level cross-site navigation modified profile");
      }
      // Second browser-controlled case: SAME real signed Medusa cookie,
      // but with deliberately configured cross-site-capable attributes.
      // This does not assert that the Medusa development server sets them.
      phase=actor.toUpperCase()+"_NONE_SECURE_BROWSER_COOKIE_FIXTURE";
      const existing=(await context.cookies(API)).find(c=>c.name==="connect.sid");
      assert(existing && existing.value.length>30);
      await context.addCookies([{
        name:existing.name,value:existing.value,url:API,
        httpOnly:true,secure:true,sameSite:"None",
      }]);
      const replaced=(await context.cookies(API)).find(c=>c.name==="connect.sid");
      assert(replaced && replaced.secure && replaced.sameSite==="None",
        "Chrome SameSite=None; Secure setup did not apply");
      phase=actor.toUpperCase()+"_CROSS_SITE_FORM_WITH_COOKIE";
      await attackerForm(page,actor,
        "CI-12Y-WITH-COOKIE-"+randomBytes(5).toString("hex"),true);
      assert.equal(await getProfile(page,actor),changed,
        "Real browser cross-site cookie POST changed profile");
      // Stage 12Z: SameSite=None; Secure forces real credential delivery
      // in the top-level and redirect variants. 302 GET may succeed;
      // 307 POST must be denied on the scope-guarded Admin route.
      for(const kind of ["direct","302","307"]){
        phase=actor.toUpperCase()+"_NONE_SECURE_TOP_LEVEL_"+kind;
        await topLevelNavigation(page,actor,kind,true);
        assert.equal(await getProfile(page,actor),changed,
          "Cross-site browser redirect/top-level mutation changed profile");
      }
    } catch {
      // Preserve the REAL original test stage in sanitized CI logs, even
      // though a best-effort profile restore runs in the finally block.
      console.error("::error::SHQIPSHOP_226_STAGE12Z_PRIMARY_FAILURE_AT_"+phase);
      throw new Error("Stage12Z browser invariant failed");
    } finally {
      phase=actor.toUpperCase()+"_RESTORE_PROFILE";
      await trustedMutation(page,actor,before);
      assert.equal(await getProfile(page,actor),before,
        "Synthetic data restore failed");
    }
    console.log("SHQIPSHOP_226_STAGE12Y_"+actor.toUpperCase()+
      "_TRUSTED_POSITIVE_AND_UNTRUSTED_NEGATIVE_PASSED");
  } finally {await context.close();}
}

/**
 * Stage 12AD: browser-initiated product/cart mutation characterization, not
 * exploitation of real users. Both routes are outside Stage12X's profile guard.
 * Every successful browser mutation is restored with a separate signed CI
 * cookie (or the guest's publishable key) and verified in disposable Postgres.
 */
function adDb(field,id){
  const columns={title:["product","prod"],email:["cart","cart"],name:["region","reg"]};
  assert(Object.hasOwn(columns,field),"Allowed CI column only");
  const [table,prefix]=columns[field];
  assert(new RegExp("^"+prefix+"_[A-Za-z0-9_-]{8,}$").test(id));
  const uri=new URL(env.SHQIPSHOP_STAGE12AD_DB_A);
  assert(uri.protocol==="postgres:"&&uri.hostname==="127.0.0.1"&&uri.port==="5432"&&
    uri.username==="shqipshop_226_a"&&uri.pathname==="/shqipshop_226_a"&&
    uri.password.length>8&&!uri.hash&&!uri.search,"Exact synthetic A DB only");
  const q="SELECT COALESCE("+field+",'') FROM "+table+
    " WHERE id='"+id+"' AND deleted_at IS NULL";
  const out=spawnSync("psql",["-X","-A","-t","-v","ON_ERROR_STOP=1",
    "-d",env.SHQIPSHOP_STAGE12AD_DB_A,"-c",q],
    {encoding:"utf8",timeout:12000,stdio:["ignore","pipe","ignore"]});
  assert.equal(out.status,0,"Disposable PostgreSQL readback failed");
  return out.stdout.trim();
}
async function adHttp(method,route,headers={},body){
  const res=await fetch("http://127.0.0.1:9003"+route,{method,headers,
    body:body===undefined?undefined:JSON.stringify(body),
    redirect:"manual",signal:AbortSignal.timeout(12000)});
  const raw=await res.text();
  let data={};try{data=JSON.parse(raw)}catch{}
  return {status:res.status,data};
}
async function adContextCookie(ctx){
  const c=(await ctx.cookies(API)).find(c=>c.name==="connect.sid");
  assert(c&&c.httpOnly&&c.value.length>30);
  return {value:c.value,header:"connect.sid="+c.value};
}
async function adPolicyNone(ctx){
  const original=await adContextCookie(ctx);
  await ctx.addCookies([{name:"connect.sid",value:original.value,url:API,
    secure:true,httpOnly:true,sameSite:"None"}]);
  const next=(await ctx.cookies(API)).find(c=>c.name==="connect.sid");
  assert(next&&next.value===original.value&&next.sameSite==="None"&&next.secure,
    "Real Chromium None;Secure cookie fixture mismatch");
}
async function adRestore(s,baseline){
  const headers={"content-type":"application/json"};
  if(s.kind.startsWith("admin-")){
    headers.cookie=s.restoreCookie;
    headers.origin=ADMIN;
  } else {
    headers["x-publishable-api-key"]=proof.A.key;
    headers.origin=SHOP;
  }
  const r=await adHttp("POST",s.route,headers,{[s.field]:baseline});
  assert.equal(r.status,200,"Scoped synthetic browser state restore failed");
  assert.equal(adDb(s.field,s.id),baseline,"Browser probe database restore unverified");
}
function adObservedAfter(before,s){
  return stage12adEvents.slice(before).filter(x=>x.target===s.kind);
}
async function adTrustedBrowser(page,s,value){
  await page.goto(s.kind.startsWith("admin-")?ADMIN+"/":SHOP+"/",{waitUntil:"load"});
  const before=stage12adEvents.length;
  const outcome=await page.evaluate(async d=>{
    try{
      const headers={"content-type":"application/json"};
      if(d.key)headers["x-publishable-api-key"]=d.key;
      const r=await fetch(d.target,{method:"POST",credentials:"include",headers,
        body:JSON.stringify({[d.field]:d.value})});
      return {type:"HTTP",status:r.status};
    }catch(error){return {type:"ERROR",error:error?.name??"unknown"}}
  },{target:API+s.route,field:s.field,value,key:s.kind==="guest-cart"?proof.A.key:null});
  assert.deepEqual(outcome,{type:"HTTP",status:200},
    "Genuine trusted browser JSON write failed");
  const events=adObservedAfter(before,s).filter(x=>x.method==="POST");
  assert.equal(events.length,1,"Trusted JSON POST was not observed by HTTPS reverse proxy");
  assert.equal(events[0].cookieSent,true,"Genuine Medusa cookie absent on trusted browser write");
  assert.equal(events[0].status,200);
  assert.equal(adDb(s.field,s.id),value,"Trusted browser mutation not persisted");
  console.log("SHQIPSHOP_226_STAGE12AD_"+s.kind.toUpperCase().replace("-","_")+
    "_TRUSTED_BROWSER_JSON_PERSISTED");
}
function adClassify(s,before,marker){
  const after=adDb(s.field,s.id);
  assert(after===before||after===marker,"Unexpected mutation of synthetic DB value");
  return after===marker?"PERSISTED":"NO_CHANGE";
}
async function adForm(page,s,mode,marker,policy){
  phase=(s.kind==="admin-region"?"12AF_":"12AD_")+s.kind+"_FORM_"+policy+"_"+mode;
  const start=stage12adEvents.length;
  await page.goto(EVIL+"/",{waitUntil:"load"});
  const target=API+s.route;
  const responsePromise=page.waitForResponse(r=>
    r.url()===target&&r.request().method()==="POST",{timeout:14000});
  await page.evaluate(d=>{
    const form=document.createElement("form");
    form.method="POST";form.action=d.target;
    form.enctype="application/x-www-form-urlencoded";
    if(d.mode==="iframe"){
      const frame=document.createElement("iframe");
      frame.name="stage12ad-synthetic-frame";frame.style.display="none";
      document.body.appendChild(frame);form.target=frame.name;
    }
    const input=document.createElement("input");
    input.name=d.field;input.value=d.value;form.appendChild(input);
    document.body.appendChild(form);form.submit();
  },{target,field:s.field,value:marker,mode});
  const response=await responsePromise;
  if(mode==="top-level")
    await page.waitForURL(target,{waitUntil:"domcontentloaded",timeout:14000});
  else await response.finished();
  const events=adObservedAfter(start,s).filter(x=>x.method==="POST");
  assert.equal(events.length,1,"Expected one real native form POST");
  const event=events[0];
  assert.equal(event.origin,EVIL,"Unexpected native form origin");
  assert.equal(event.fetchSite,"cross-site","Expected real cross-site browser metadata");
  assert.equal(event.contentType,"application/x-www-form-urlencoded");
  assert.equal(event.status,response.status());
  if(policy==="NONE_SECURE_FIXTURE")assert(event.cookieSent,
    "None; Secure Chrome fixture did not send real Medusa cookie");
  assert([200,400,401,403,404,415,422].includes(response.status()),
    "Unexpected real browser form HTTP status");
  const persistence=adClassify(s,s.expected,marker);
  // Stage12AE: the same previously successful real-browser CSRF attempt
  // MUST now fail explicitly, not merely be recorded as a characterization.
  if(s.kind==="admin-product"){
    assert.equal(response.status(),event.cookieSent?403:401,
      "Stage12AE Admin product native-form attack not explicitly denied");
    assert.equal(persistence,"NO_CHANGE",
      "Stage12AE Admin product browser attack persisted a mutation");
  }
  console.log(s.kind==="admin-region"?
    "SHQIPSHOP_226_STAGE12AF_ADMIN_REGION_BROWSER_FORM_CLASS":
    "SHQIPSHOP_226_STAGE12AD_FORM_CLASS",JSON.stringify({
    route:s.kind,mode,cookiePolicy:policy,cookieSent:event.cookieSent,
    publicKeySent:event.publicKeySent,httpStatus:response.status(),persistence,
    realBrowser:true,
  }));
  if(persistence==="PERSISTED")await adRestore(s,s.expected);
}
async function adCrossFetch(page,s,marker,policy){
  phase=(s.kind==="admin-region"?"12AF_":"12AD_")+s.kind+"_JSON_FETCH_"+policy;
  const start=stage12adEvents.length;
  await page.goto(EVIL+"/",{waitUntil:"load"});
  const result=await page.evaluate(async d=>{
    try{
      const headers={"content-type":"application/json"};
      if(d.key)headers["x-publishable-api-key"]=d.key;
      const r=await fetch(d.target,{method:"POST",mode:"cors",
        credentials:"include",headers,
        body:JSON.stringify({[d.field]:d.value})});
      return {kind:"HTTP",status:r.status};
    }catch(error){return {kind:"BROWSER_REJECTED",type:error?.name??"unknown"}}
  },{target:API+s.route,field:s.field,value:marker,
    key:s.kind==="guest-cart"?proof.A.key:null});
  const events=adObservedAfter(start,s);
  const options=events.filter(x=>x.method==="OPTIONS");
  const posts=events.filter(x=>x.method==="POST");
  assert(options.length>=1,"Real JSON cross-site fetch was not preflighted");
  assert(posts.length<=1,"Repeated cross-site POST request");
  if(posts.length===0)assert.equal(result.kind,"BROWSER_REJECTED",
    "Cross-site JSON without POST did not produce browser CORS denial");
  const persistence=adClassify(s,s.expected,marker);
  console.log(s.kind==="admin-region"?
    "SHQIPSHOP_226_STAGE12AF_ADMIN_REGION_JSON_FETCH_CLASS":
    "SHQIPSHOP_226_STAGE12AD_JSON_FETCH_CLASS",JSON.stringify({
    route:s.kind,cookiePolicy:policy,
    preflightObserved:options.length>=1,postSent:posts.length===1,
    cookieOnPost:posts.length?posts[0].cookieSent:false,
    browserResult:result.kind,httpStatus:posts.length?posts[0].status:null,
    persistence,realBrowser:true,
  }));
  if(persistence==="PERSISTED")await adRestore(s,s.expected);
}
async function adCases(browser,s){
  const ctx=await browser.newContext({ignoreHTTPSErrors:true});
  try{
    const page=await login(ctx,s.kind.startsWith("admin-")?"admin":"customer");
    const signed=await adContextCookie(ctx);
    s.restoreCookie=signed.header;
    const trusted=s.kind.startsWith("admin-")?
      "CI-"+(s.kind==="admin-region"?"12AF":"12AD")+"-TRUSTED-"+randomBytes(5).toString("hex"):
      "ci12ad-trusted-"+randomBytes(5).toString("hex")+"@example.invalid";
    try{
      phase=(s.kind==="admin-region"?"12AF_":"12AD_")+s.kind+"_TRUSTED";
      await adTrustedBrowser(page,s,trusted);
      s.expected=trusted;
      for(const policy of ["SERVER_RECENT_DEFAULT","NONE_SECURE_FIXTURE"]){
        if(policy==="NONE_SECURE_FIXTURE")await adPolicyNone(ctx);
        for(const mode of ["iframe","top-level"]){
          const marker=s.kind.startsWith("admin-")?
            "CI-"+(s.kind==="admin-region"?"12AF":"12AD")+"-ATTACK-"+randomBytes(5).toString("hex"):
            "ci12ad-attack-"+randomBytes(5).toString("hex")+"@example.invalid";
          await adForm(page,s,mode,marker,policy);
        }
        const marker=s.kind.startsWith("admin-")?
          "CI-"+(s.kind==="admin-region"?"12AF":"12AD")+"-JSON-"+randomBytes(5).toString("hex"):
          "ci12ad-json-"+randomBytes(5).toString("hex")+"@example.invalid";
        await adCrossFetch(page,s,marker,policy);
      }
    }finally{
      phase=(s.kind==="admin-region"?"12AF_":"12AD_")+s.kind+"_RESTORE_ORIGINAL";
      if(adDb(s.field,s.id)!==s.original)await adRestore(s,s.original);
      assert.equal(adDb(s.field,s.id),s.original,
        "Final original synthetic value not restored");
    }
  }finally{await ctx.close();}
}
async function runStage12AD(browser){
  phase="12AD_ADMIN_BASELINE";
  const ctx=await browser.newContext({ignoreHTTPSErrors:true});
  let product;
  try{
    await login(ctx,"admin");
    const c=await adContextCookie(ctx);
    const list=await adHttp("GET","/admin/products?limit=1",{cookie:c.header});
    assert.equal(list.status,200);
    product=list.data.products?.[0];
    assert(product?.id&&typeof product.title==="string"&&product.title.length>0);
  }finally{await ctx.close();}
  const initialTitle=adDb("title",product.id);
  assert.equal(initialTitle,product.title);
  await adCases(browser,{kind:"admin-product",id:product.id,
    route:"/admin/products/"+encodeURIComponent(product.id),
    field:"title",original:initialTitle,expected:initialTitle});
  console.log("SHQIPSHOP_226_STAGE12AE_REAL_CHROMIUM_ADMIN_PRODUCT_CSRF_DENIED_AND_SQL_UNCHANGED");
  phase="12AD_GUEST_CART_CREATE";
  const regions=await adHttp("GET","/store/regions",
    {"x-publishable-api-key":proof.A.key});
  assert.equal(regions.status,200);
  const region=regions.data.regions?.find(x=>x.name==="Shqipëri"&&x.currency_code==="all");
  assert(region?.id);
  const created=await adHttp("POST","/store/carts",
    {"x-publishable-api-key":proof.A.key,"content-type":"application/json",
      origin:SHOP},{region_id:region.id});
  assert.equal(created.status,200);
  const id=created.data.cart?.id;
  assert(/^cart_[A-Za-z0-9_-]{8,}$/.test(id));
  const original="ci12ad-original-"+randomBytes(5).toString("hex")+"@example.invalid";
  const cartRoute="/store/carts/"+encodeURIComponent(id);
  const prepared=await adHttp("POST",cartRoute,
    {"x-publishable-api-key":proof.A.key,"content-type":"application/json",origin:SHOP},
    {email:original});
  assert.equal(prepared.status,200);
  assert.equal(adDb("email",id),original);
  await adCases(browser,{kind:"guest-cart",id,route:cartRoute,
    field:"email",original,expected:original});
  console.log("SHQIPSHOP_226_STAGE12AD_REAL_CHROMIUM_HTML_AND_FETCH_SQL_CLASSIFICATION_COMPLETE");
  console.log("SHQIPSHOP_226_STAGE12AD_CI_BROWSER_FIXTURES_NOT_PRODUCTION_TLS_OR_GLOBAL_CSRF");
}


/** Stage12AF: one other high-impact built-in Admin commerce-region setting.
 * Only the synthetic region name is modified, never currency/tax/providers.
 */
async function runStage12AF(browser){
  phase="12AF_ADMIN_REGION_BASELINE";
  const ctx=await browser.newContext({ignoreHTTPSErrors:true});
  let region;
  try{
    await login(ctx,"admin");
    const signed=await adContextCookie(ctx);
    const list=await adHttp("GET","/admin/regions?limit=100",{cookie:signed.header});
    assert.equal(list.status,200,"Region Admin list unavailable");
    region=list.data.regions?.find(x=>x.name==="Shqipëri"&&x.currency_code==="all");
    assert(region?.id&&/^reg_[A-Za-z0-9_-]{8,}$/.test(region.id),
      "Expected seeded synthetic Albania region");
  }finally{await ctx.close();}
  const original=adDb("name",region.id);
  assert.equal(original,region.name,"Browser region HTTP/SQL baseline mismatch");
  await adCases(browser,{kind:"admin-region",id:region.id,
    route:"/admin/regions/"+encodeURIComponent(region.id),
    field:"name",original,expected:original});
  console.log("SHQIPSHOP_226_STAGE12AF_REAL_CHROMIUM_REGION_CSRF_CLASSIFICATION_AND_RESTORE_PASSED");
  console.log("SHQIPSHOP_226_STAGE12AF_CI_ONLY_NOT_PRODUCTION_CSRF_CERTIFICATION");
}

async function main(){
  phase="TLS";
  await proxyServers(issueCert());
  phase="BROWSER";
  const hostRules=domains.map(d=>"MAP "+d+" 127.0.0.1").join(", ");
  browser=await chromium.launch({
    headless:true,executablePath:chromeBin,
    args:["--no-proxy-server","--host-resolver-rules="+hostRules,
      "--ignore-certificate-errors","--disable-background-networking"],
  });
  phase="CUSTOMER";
  await runActor("customer",browser);
  phase="ADMIN";
  await runActor("admin",browser);
  phase="STAGE12AD";
  await runStage12AD(browser);
  phase="STAGE12AF";
  await runStage12AF(browser);
  console.log("SHQIPSHOP_226_STAGE12Y_BROWSER_LAX_AND_NONE_SECURE_COOKIE_CLASSIFICATION_PASSED");
  console.log("SHQIPSHOP_226_STAGE12Z_BROWSER_TOP_LEVEL_AND_302_307_REDIRECT_CLASSIFICATION_PASSED");
  console.log("SHQIPSHOP_226_STAGE12Y_NOT_PRODUCTION_CERTIFICATE_OR_PSP");
}
main().catch(()=>{
  console.error("::error::SHQIPSHOP_226_STAGE12Y_FAILED_AT_"+phase);
  process.exitCode=1;
}).finally(async()=>{
  if(browser)await browser.close().catch(()=>{});
  await Promise.all(instances.map(closeServer));
  if(certDir)fs.rmSync(certDir,{recursive:true,force:true});
});
