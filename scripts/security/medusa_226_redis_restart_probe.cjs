"use strict";
/**
 * Stage 12R: CI-only hard Redis A crash/restart. No real users or live data.
 * Docker kill/start is restricted to the exact GitHub Actions Redis A service
 * container, never by a guessed name, port, docker ps, or production target.
 * This establishes recovery and classifies session/data loss, NOT Redis HA.
 */
const assert = require("node:assert/strict");
const { readFileSync, realpathSync } = require("node:fs");
const { relative, isAbsolute, sep, join } = require("node:path");
const { execFileSync } = require("node:child_process");
const { randomBytes } = require("node:crypto");
const { createConnection } = require("node:net");

let phase = "PREFLIGHT";
const env = process.env;
for (const [key,value] of Object.entries({
  CI:"true",NODE_ENV:"development",SHQIPSHOP_MEDUSA_CANDIDATE_CI:"true",
  SHQIPSHOP_REQUIRE_REDIS:"true",REDIS_URL:"redis://127.0.0.1:6379",
})) assert.equal(env[key],value,"Disposable CI only");
const temp=realpathSync(env.RUNNER_TEMP),candidate=realpathSync(env.SHQIPSHOP_MEDUSA_CANDIDATE_DIR);
const proofFile=realpathSync(env.SHQIPSHOP_CI_SESSION_PROOF_FILE);
for(const p of [candidate,proofFile]){
  const rel=relative(temp,p);
  assert(rel && rel!==".." && !rel.startsWith(".."+sep) && !isAbsolute(rel),
    "Temporary runner data only");
}
const manifest=JSON.parse(readFileSync(join(candidate,"apps/backend/package.json"),"utf8"));
assert.equal(manifest.dependencies["@medusajs/medusa"],"2.22.6");
const proof=JSON.parse(readFileSync(proofFile,"utf8"));
for(const id of ["A","B"]){
  assert(proof[id]?.key?.length>10);
  for(const actor of ["customer","admin"]){
    assert(proof[id][actor]?.id && proof[id][actor]?.cookie?.includes("connect.sid="));
  }
}
const aId=env.SHQIPSHOP_STAGE12R_REDIS_A_ID;
const bId=env.SHQIPSHOP_STAGE12R_REDIS_B_ID;
assert(/^[a-f0-9]{64}$/.test(aId||"") && /^[a-f0-9]{64}$/.test(bId||"") && aId!==bId,
  "GitHub service container IDs required");
function docker(...args){
  return execFileSync("docker",args,{encoding:"utf8",timeout:15000,stdio:["ignore","pipe","pipe"]}).trim();
}
for(const [id,port] of [[aId,6379],[bId,6381]]){
  assert.equal(docker("inspect","--format","{{.Config.Image}}",id),"redis:7-alpine",
    "Only the exact Redis CI service image is permitted");
  assert.equal(docker("inspect","--format","{{.State.Running}}",id),"true");
  assert(docker("port",id,"6379/tcp").split("\n").some(line=>line.endsWith(":"+port)),
    "Redis port mapping did not match the isolated CI service");
}
function redis(port,args,timeout=2500){
  assert([6379,6381].includes(port));
  const frame="*"+args.length+"\r\n"+args.map(a=>"$"+Buffer.byteLength(String(a))+"\r\n"+a+"\r\n").join("");
  return new Promise((resolve,reject)=>{
    const socket=createConnection({host:"127.0.0.1",port});
    let done=false,buffer="";
    function finish(err,ans){if(done)return;done=true;socket.destroy();err?reject(err):resolve(ans);}
    socket.setTimeout(timeout,()=>finish(new Error("Redis timeout")));
    socket.once("error",()=>finish(new Error("Redis unavailable")));
    socket.once("connect",()=>socket.write(frame));
    socket.on("data",chunk=>{
      buffer+=chunk.toString("utf8");
      const end=buffer.indexOf("\r\n");if(end<0)return;
      const line=buffer.slice(0,end);
      if(line.startsWith("+"))return finish(null,line.slice(1));
      if(line==="$-1")return finish(null,null);
      if(line.startsWith("$")){
        const len=Number(line.slice(1));
        if(Number.isInteger(len)&&len>=0&&buffer.length>=end+2+len+2)
          return finish(null,buffer.slice(end+2,end+2+len));
      }
      if(line.startsWith("-"))return finish(new Error("Redis error"));
    });
  });
}
const host="http://127.0.0.1:";
async function profile(port,tenant,actor,keyTenant=tenant,timeout=4500,cookie=tenant[actor].cookie){
  const path=actor==="customer"?"/store/customers/me":"/admin/users/me";
  const headers={cookie};
  if(actor==="customer")headers["x-publishable-api-key"]=keyTenant.key;
  try{
    const res=await fetch(host+port+path,{headers,redirect:"manual",signal:AbortSignal.timeout(timeout)});
    const text=await res.text();
    // Never log the response or cookie. Check whether error bodies contain any
    // fixture identity before classifying failure as non-disclosing.
    if(res.status!==200){
      for(const m of [proof.A,proof.B])for(const role of ["customer","admin"])
        assert(!text.includes(m[role].id),"Private synthetic identifier appeared in failed response");
      return {status:res.status};
    }
    let obj={};try{obj=JSON.parse(text)}catch{}
    return {status:200,id:obj[actor==="customer"?"customer":"user"]?.id};
  }catch(err){
    if(err?.name==="TimeoutError"||err?.name==="AbortError")return {status:"timeout"};
    if(err instanceof TypeError)return {status:"network"};
    throw new Error("Protected HTTP response classification failed");
  }
}
async function own(port,t,actor,cookie){
  const r=await profile(port,t,actor,t,6500,cookie);
  assert.equal(r.status,200,"Own account not reachable after Redis restore");
  assert.equal(r.id,t[actor].id,"Session principal identity mismatch");
}
async function denyForeign(actor){
  const r=await profile(9002,proof.B,actor,proof.A);
  assert([401,403].includes(r.status),"Foreign merchant cookie accepted at A clone");
}
async function bHealthy(){
  assert.equal(await redis(6381,["PING"]),"PONG");
  for(const actor of ["customer","admin"])await own(9001,proof.B,actor);
}
async function waitForA(){
  const until=Date.now()+40000;
  while(Date.now()<until){
    try{if(await redis(6379,["PING"],1200)==="PONG")return;}
    catch{}
    await new Promise(r=>setTimeout(r,700));
  }
  throw new Error("Redis A failed to become reachable after restart");
}
async function relogin(actor){
  const email=actor==="customer"?"shopper-a@shqipshop.example.invalid":"admin-a@shqipshop.example.invalid";
  const password=env[actor==="customer"?"SHQIPSHOP_A_CUSTOMER_PASSWORD":"SHQIPSHOP_A_ADMIN_PASSWORD"];
  assert(password?.length>=12,"Synthetic credentials missing");
  const kind=actor==="customer"?"customer":"user";
  const login=await fetch(host+"9000/auth/"+kind+"/emailpass",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({email,password}),signal:AbortSignal.timeout(12000),
  });
  assert.equal(login.status,200,"Fresh synthetic credential login failed");
  const token=(await login.json()).token;
  assert(token?.length>20,"Login did not return synthetic bearer token");
  const session=await fetch(host+"9000/auth/session",{
    method:"POST",headers:{authorization:"Bearer "+token},
    signal:AbortSignal.timeout(12000),
  });
  assert.equal(session.status,200,"Fresh cookie session creation failed");
  const cookies=session.headers.getSetCookie?.()??[];
  const cookie=cookies.map(s=>s.split(";")[0]).find(s=>s.startsWith("connect.sid="));
  assert(cookie,"New session cookie missing");
  await own(9000,proof.A,actor,cookie);
  await own(9002,proof.A,actor,cookie);
}
async function main(){
  phase="BASELINE";
  await bHealthy();
  assert.equal(await redis(6379,["PING"]),"PONG");
  for(const actor of ["customer","admin"]){
    await own(9000,proof.A,actor);
    await own(9002,proof.A,actor);
    await denyForeign(actor);
  }
  const sentinel="shqipshop-ci-12r-"+randomBytes(10).toString("hex");
  const value=randomBytes(10).toString("hex");
  assert.equal(await redis(6379,["SET",sentinel,value,"EX","300"]),"OK");
  assert.equal(await redis(6379,["GET",sentinel]),value);
  console.log("SHQIPSHOP_226_STAGE12R_PRE_CRASH_SESSIONS_AND_SENTINEL_PASSED");
  let killed=false;
  try{
    phase="KILL_DISPOSABLE_REDIS_A";
    docker("kill","--signal=KILL",aId);
    killed=true;
    assert.equal(docker("inspect","--format","{{.State.Running}}",aId),"false");
    let aDown=false;
    try{await redis(6379,["PING"],1000)}catch{aDown=true;}
    assert(aDown,"Hard Redis A outage was not confirmed");
    await bHealthy();
    console.log("SHQIPSHOP_226_STAGE12R_HARD_A_DOWN_B_STILL_HEALTHY");
    phase="PROTECTED_REQUESTS_DURING_OUTAGE";
    for(const actor of ["customer","admin"]){
      const result=await profile(9002,proof.A,actor,proof.A,2200);
      assert([401,403,500,502,503,504,"timeout","network"].includes(result.status),
        "Private A identity returned during confirmed hard Redis outage");
      if(result.status===500)console.log("SHQIPSHOP_226_STAGE12R_A_HTTP_500_DURING_DOWN_NOT_AVAILABILITY_CERTIFICATION");
    }
    await bHealthy();
    console.log("SHQIPSHOP_226_STAGE12R_NO_PRIVATE_A_IDENTITY_DURING_HARD_DOWN");
  }finally{
    if(killed){
      phase="RESTART_ONLY_DISPOSABLE_REDIS_A";
      docker("start",aId);
    }
  }
  phase="REDIS_RECOVERY";
  await waitForA();
  assert.equal(docker("inspect","--format","{{.State.Running}}",aId),"true");
  await bHealthy();
  console.log("SHQIPSHOP_226_STAGE12R_REDIS_A_CONNECTION_RESTORED");
  const survived=await redis(6379,["GET",sentinel]);
  assert(survived===null||survived===value,"Unexpected sentinel state after Redis hard restart");
  console.log("SHQIPSHOP_226_STAGE12R_SENTINEL_"+(survived===value?"SURVIVED":"LOST"));
  phase="OLD_SESSIONS_AFTER_RESTART";
  let retained=0,lost=0;
  for(const actor of ["customer","admin"]){
    const a=await profile(9000,proof.A,actor);
    const clone=await profile(9002,proof.A,actor);
    for(const response of [a,clone]){
      if(response.status===200){
        assert.equal(response.id,proof.A[actor].id,"Post-restart old cookie switched principal");
        retained++;
      }else{
        assert([401,403].includes(response.status),
          "Post-restart cookie was neither valid nor definitively denied");
        lost++;
      }
    }
    await denyForeign(actor);
  }
  console.log("SHQIPSHOP_226_STAGE12R_OLD_COOKIE_OUTCOMES",{retained,lost});
  await bHealthy();
  phase="FRESH_LOGIN_AFTER_RESTART";
  for(const actor of ["customer","admin"])await relogin(actor);
  for(const port of [9000,9001,9002]){
    const h=await fetch(host+port+"/health",{signal:AbortSignal.timeout(5000)});
    assert.equal(h.status,200,"API not healthy after isolated Redis A restart");
  }
  console.log("SHQIPSHOP_226_STAGE12R_NEW_A_SESSIONS_RECOVERED_WITH_B_ISOLATED");
  console.log("SHQIPSHOP_226_STAGE12R_CI_ONLY_NO_HA_OR_PSP_CERTIFICATION");
}
main().catch(()=>{
  // No cookies, tokens, IDs, Redis key names, or HTTP bodies in logs.
  console.error("::error::SHQIPSHOP_226_STAGE12R_FAILED_AT_"+phase);
  process.exitCode=1;
});
