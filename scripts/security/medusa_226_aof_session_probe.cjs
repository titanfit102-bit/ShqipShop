"use strict";
/**
 * Stage 12S: synthetic Medusa 2.22.6 session proof against a dedicated Redis
 * 7 AOF (appendfsync always, RDB snapshots disabled) in this GitHub runner.
 *
 * The disposable container is created by the candidate CI shell on localhost
 * port 6382; it is never a production Redis service. Crash/restart is scoped
 * to this exact container ID, image, label and published port.
 */
const assert = require("node:assert/strict");
const { readFileSync, realpathSync } = require("node:fs");
const { relative, isAbsolute, sep, join } = require("node:path");
const { execFileSync } = require("node:child_process");
const { randomBytes } = require("node:crypto");
const { createConnection } = require("node:net");

let phase = "PREFLIGHT";
const env = process.env;
for (const [k,v] of Object.entries({
  CI:"true",NODE_ENV:"development",
  SHQIPSHOP_MEDUSA_CANDIDATE_CI:"true",
  SHQIPSHOP_REQUIRE_REDIS:"true",
  REDIS_URL:"redis://127.0.0.1:6379",
})) assert.equal(env[k],v,"Stage 12S is restricted to disposable CI");
const temp=realpathSync(env.RUNNER_TEMP);
const candidate=realpathSync(env.SHQIPSHOP_MEDUSA_CANDIDATE_DIR);
const sessionProof=realpathSync(env.SHQIPSHOP_CI_SESSION_PROOF_FILE);
for (const path of [candidate,sessionProof]) {
  const rel=relative(temp,path);
  assert(rel && rel!==".." && !rel.startsWith(".."+sep) && !isAbsolute(rel),
    "Only temporary CI files may be used");
}
const manifest=JSON.parse(readFileSync(join(candidate,"apps/backend/package.json"),"utf8"));
assert.equal(manifest.dependencies["@medusajs/medusa"],"2.22.6");
const proof=JSON.parse(readFileSync(sessionProof,"utf8"));
for (const merchant of ["A","B"]) {
  assert(proof[merchant]?.key?.length>10);
  for (const actor of ["customer","admin"])
    assert(proof[merchant][actor]?.id && proof[merchant][actor]?.cookie?.includes("connect.sid="));
}
const container=env.SHQIPSHOP_STAGE12S_AOF_ID;
assert(/^[a-f0-9]{64}$/.test(container||""),"Exact CI Redis AOF container ID missing");
function docker(...args){
  return execFileSync("docker",args,{encoding:"utf8",timeout:18000,stdio:["ignore","pipe","pipe"]}).trim();
}
assert.equal(docker("inspect","--format","{{.Config.Image}}",container),"redis:7-alpine");
assert.equal(docker("inspect","--format",'{{ index .Config.Labels "shqipshop.scope" }}',container),"stage12s-ci");
assert.equal(docker("inspect","--format","{{.State.Running}}",container),"true");
assert(docker("port",container,"6379/tcp").split("\n").some(s=>s.endsWith(":6382")),
  "Only CI Redis AOF 6382 may be crash-tested");
function cli(...args){
  return docker("exec",container,"redis-cli","--raw",...args);
}
async function ping(port,timeout=1500){
  return new Promise((resolve,reject)=>{
    const s=createConnection({host:"127.0.0.1",port});
    let done=false,answer="";
    function finish(e,r){if(done)return;done=true;s.destroy();e?reject(e):resolve(r)}
    s.setTimeout(timeout,()=>finish(new Error("Redis PING timeout")));
    s.once("error",()=>finish(new Error("Redis PING unavailable")));
    s.once("connect",()=>s.write("*1\r\n$4\r\nPING\r\n"));
    s.on("data",d=>{
      answer+=d.toString("utf8");
      if(answer.includes("\r\n"))finish(null,answer.slice(0,answer.indexOf("\r\n")));
    });
  });
}
const base="http://127.0.0.1:";
async function profile(port, actor, cookie, tenant=proof.A, key=proof.A.key, timeout=5000){
  const path=actor==="customer"?"/store/customers/me":"/admin/users/me";
  const headers={cookie};
  if(actor==="customer")headers["x-publishable-api-key"]=key;
  try{
    const response=await fetch(base+port+path,{method:"GET",headers,redirect:"manual",
      signal:AbortSignal.timeout(timeout)});
    const raw=await response.text();
    if(response.status!==200){
      for(const merchant of ["A","B"])for(const role of ["customer","admin"])
        assert(!raw.includes(proof[merchant][role].id),"Private synthetic ID found in unsuccessful response");
      return {status:response.status};
    }
    let data={};try{data=JSON.parse(raw)}catch{}
    return {status:200,id:data[actor==="customer"?"customer":"user"]?.id};
  }catch(error){
    if(["AbortError","TimeoutError"].includes(error?.name))return {status:"timeout"};
    if(error instanceof TypeError)return {status:"network"};
    throw new Error("Unexpected identity HTTP classification");
  }
}
async function own(actor,cookie){
  const result=await profile(9003,actor,cookie);
  assert.equal(result.status,200,"AOF cookie missing or rejected after Redis recovery");
  assert.equal(result.id,proof.A[actor].id,"AOF cookie returned wrong principal");
}
async function otherTenantDenied(actor){
  const r=await profile(9003,actor,proof.B[actor].cookie);
  assert([401,403].includes(r.status),"Foreign merchant B session accepted by AOF A API");
}
async function bIndependent(){
  assert.equal(await ping(6381),"+PONG","Merchant B Redis unavailable");
  for(const actor of ["customer","admin"]){
    const r=await profile(9001,actor,proof.B[actor].cookie,proof.B,proof.B.key);
    assert.equal(r.status,200,"Merchant B cookie failed unexpectedly");
    assert.equal(r.id,proof.B[actor].id,"Merchant B principal changed");
  }
}
async function freshCookie(actor){
  const kind=actor==="customer"?"customer":"user";
  const email=actor==="customer"?"shopper-a@shqipshop.example.invalid":"admin-a@shqipshop.example.invalid";
  const password=env[actor==="customer"?"SHQIPSHOP_A_CUSTOMER_PASSWORD":"SHQIPSHOP_A_ADMIN_PASSWORD"];
  assert(password?.length>=12,"Synthetic password missing");
  const login=await fetch(base+"9003/auth/"+kind+"/emailpass",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({email,password}),signal:AbortSignal.timeout(12000),
  });
  assert.equal(login.status,200,"Disposable AOF login failed");
  const jwt=(await login.json()).token;
  assert(jwt?.length>20);
  const sess=await fetch(base+"9003/auth/session",{
    method:"POST",headers:{authorization:"Bearer "+jwt},
    signal:AbortSignal.timeout(12000),
  });
  assert.equal(sess.status,200,"AOF cookie session creation failed");
  const cookies=sess.headers.getSetCookie?.()??[];
  const cookie=cookies.map(s=>s.split(";")[0]).find(s=>s.startsWith("connect.sid="));
  assert(cookie,"AOF cookie missing");
  await own(actor,cookie);
  return cookie;
}
async function waitForAof(){
  const until=Date.now()+40000;
  while(Date.now()<until){
    try{if(await ping(6382,1200)==="+PONG")return;}
    catch{}
    await new Promise(r=>setTimeout(r,500));
  }
  throw new Error("AOF Redis never responded after hard restart");
}
async function main(){
  phase="BASELINE";
  assert.equal(await ping(6382),"+PONG");
  assert.equal(await ping(6379),"+PONG");
  await bIndependent();
  assert.equal(cli("CONFIG","GET","appendonly").split("\n").at(-1),"yes");
  assert.equal(cli("CONFIG","GET","appendfsync").split("\n").at(-1),"always");
  assert.equal(cli("CONFIG","GET","save"),"save","RDB snapshotting must be disabled");
  const session={};
  for(const actor of ["customer","admin"]){
    session[actor]=await freshCookie(actor);
    await otherTenantDenied(actor);
  }
  const key="shqipshop-stage12s-"+randomBytes(12).toString("hex");
  const val=randomBytes(16).toString("hex");
  assert.equal(cli("SET",key,val,"EX","300"),"OK");
  assert.equal(cli("GET",key),val);
  await bIndependent();
  console.log("SHQIPSHOP_226_STAGE12S_AOF_SESSIONS_AND_SENTINEL_PERSISTED_PRE_CRASH");

  let killed=false;
  try{
    phase="KILL_AOF_ONLY";
    docker("kill","--signal=KILL",container);
    killed=true;
    assert.equal(docker("inspect","--format","{{.State.Running}}",container),"false");
    let down=false;
    try{await ping(6382,850)}catch{down=true}
    assert(down,"AOF Redis hard outage not actually observed");
    await bIndependent();
    for(const actor of ["customer","admin"]){
      const response=await profile(9003,actor,session[actor],proof.A,proof.A.key,1800);
      assert([401,403,500,502,503,504,"timeout","network"].includes(response.status),
        "Protected AOF A principal disclosed during hard Redis outage");
    }
    await bIndependent();
    console.log("SHQIPSHOP_226_STAGE12S_AOF_HARD_DOWN_B_ALIVE_NO_PROTECTED_A_ID");
  }finally{
    if(killed){
      phase="RESTART_AOF_ONLY";
      docker("start",container);
    }
  }
  phase="RECOVER_AOF";
  await waitForAof();
  assert.equal(docker("inspect","--format","{{.State.Running}}",container),"true");
  assert.equal(cli("CONFIG","GET","appendonly").split("\n").at(-1),"yes");
  assert.equal(cli("GET",key),val,"AOF synthetic sentinel did not survive real hard restart");
  console.log("SHQIPSHOP_226_STAGE12S_AOF_SENTINEL_SURVIVED_HARD_RESTART");

  phase="RECOVER_OLD_COOKIES";
  for(const actor of ["customer","admin"]){
    let valid=false;
    const until=Date.now()+30000;
    while(Date.now()<until){
      const r=await profile(9003,actor,session[actor],proof.A,proof.A.key,3000);
      if(r.status===200){
        assert.equal(r.id,proof.A[actor].id,"Restored AOF session switched principal");
        valid=true;break;
      }
      assert([401,403,500,502,503,504,"network","timeout"].includes(r.status),
        "Unexpected response before Redis client reconnect");
      await new Promise(r=>setTimeout(r,600));
    }
    assert(valid,"Existing AOF cookie was not usable after Redis restart");
    await otherTenantDenied(actor);
  }
  await bIndependent();
  console.log("SHQIPSHOP_226_STAGE12S_AOF_OLD_CUSTOMER_ADMIN_COOKIES_SURVIVED");

  phase="NEW_AUTH_AFTER_RECOVERY";
  for(const actor of ["customer","admin"])await freshCookie(actor);
  const health=await fetch(base+"9003/health",{signal:AbortSignal.timeout(5000)});
  assert.equal(health.status,200);
  console.log("SHQIPSHOP_226_STAGE12S_AOF_FRESH_AUTH_AND_B_ISOLATION_PASSED");
  console.log("SHQIPSHOP_226_STAGE12S_CI_ONLY_NOT_BACKUP_FAILOVER_OR_JWT_REVOCATION");
}
main().catch(()=>{
  console.error("::error::SHQIPSHOP_226_STAGE12S_FAILED_AT_"+phase);
  process.exitCode=1;
});
