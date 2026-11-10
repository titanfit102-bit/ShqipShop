"use strict";
/**
 * Stage 12T — replace ONLY disposable AOF Redis container with a NEW
 * container sharing a named Docker volume, while Medusa A remains live.
 * This is not a disk-failure/backup/HA/production certification.
 */
const assert = require("node:assert/strict");
const { readFileSync, realpathSync, existsSync } = require("node:fs");
const { join, relative, isAbsolute, sep } = require("node:path");
const { execFileSync } = require("node:child_process");
const { randomBytes } = require("node:crypto");
const { createConnection } = require("node:net");

let phase="SCOPE";
const env=process.env;
for (const [k,v] of Object.entries({
  CI:"true",NODE_ENV:"development",SHQIPSHOP_MEDUSA_CANDIDATE_CI:"true",
  SHQIPSHOP_REQUIRE_REDIS:"true",REDIS_URL:"redis://127.0.0.1:6379",
})) assert.equal(env[k],v,"Stage 12T permitted in disposable CI only");
assert(/^[0-9]+$/.test(env.GITHUB_RUN_ID||""));
const temp=realpathSync(env.RUNNER_TEMP);
const root=realpathSync(env.SHQIPSHOP_MEDUSA_CANDIDATE_DIR);
const sessions=realpathSync(env.SHQIPSHOP_CI_SESSION_PROOF_FILE);
for(const file of [root,sessions]){
  const rel=relative(temp,file);
  assert(rel && rel!==".." && !rel.startsWith(".."+sep) && !isAbsolute(rel),
    "Data must stay within temporary GitHub runner");
}
const medusa=JSON.parse(readFileSync(join(root,"apps/backend/package.json"),"utf8"));
assert.equal(medusa.dependencies["@medusajs/medusa"],"2.22.6");
const proof=JSON.parse(readFileSync(sessions,"utf8"));
for(const merchant of ["A","B"]){
  assert(proof[merchant]?.key?.length>10);
  for(const actor of ["customer","admin"])
    assert(proof[merchant][actor]?.id && proof[merchant][actor]?.cookie?.includes("connect.sid="));
}
const old=env.SHQIPSHOP_STAGE12T_OLD_ID;
const volume=env.SHQIPSHOP_STAGE12T_VOLUME;
const cidfile=env.SHQIPSHOP_STAGE12T_NEXT_CIDFILE;
assert(/^[a-f0-9]{64}$/.test(old||""));
assert.equal(volume,"shqipshop-stage12t-"+env.GITHUB_RUN_ID);
assert.equal(cidfile,join(temp,"shqipshop226-stage12t-next.cid"));
assert(!existsSync(cidfile),"Replacement container CID file must not preexist");
function docker(...args){
  return execFileSync("docker",args,{
    encoding:"utf8",timeout:18000,stdio:["ignore","pipe","pipe"],
  }).trim();
}
function assertVolume(){
  assert.equal(docker("volume","inspect","--format",
    '{{ index .Labels "shqipshop.scope" }}',volume),"stage12t-ci");
}
function assertContainer(id,label){
  assert(/^[a-f0-9]{64}$/.test(id));
  assert.equal(docker("inspect","--format","{{.Config.Image}}",id),"redis:7-alpine");
  assert.equal(docker("inspect","--format",
    '{{ index .Config.Labels "shqipshop.scope" }}',id),label);
  assert.equal(docker("inspect","--format",
    '{{range .Mounts}}{{if eq .Destination "/data"}}{{.Name}}{{end}}{{end}}',id),volume);
  assert(docker("port",id,"6379/tcp").split("\n").some(line=>line.endsWith(":6382")),
    "Redis must be mapped ONLY to runner-local 6382");
}
assertVolume();
assertContainer(old,"stage12s-ci");
assert.equal(docker("inspect","--format","{{.State.Running}}",old),"true");
async function ping(port,timeout=1500){
  assert([6379,6381,6382].includes(port));
  return new Promise((resolve,reject)=>{
    const socket=createConnection({host:"127.0.0.1",port});
    let done=false,buffer="";
    function finish(err,val){
      if(done)return;done=true;socket.destroy();err?reject(err):resolve(val);
    }
    socket.setTimeout(timeout,()=>finish(new Error("Redis control timeout")));
    socket.once("error",()=>finish(new Error("Redis control connection error")));
    socket.once("connect",()=>socket.write("*1\r\n$4\r\nPING\r\n"));
    socket.on("data",data=>{
      buffer+=data.toString("utf8");
      if(buffer.includes("\r\n"))finish(null,buffer.split("\r\n")[0]);
    });
  });
}
const api="http://127.0.0.1:";
async function request(port,actor,cookie,tenant=proof.A,key=proof.A.key,timeout=5000){
  const path=actor==="customer"?"/store/customers/me":"/admin/users/me";
  const headers={...(cookie?{cookie}:{})};
  if(actor==="customer")headers["x-publishable-api-key"]=key;
  try{
    const response=await fetch(api+port+path,{headers,redirect:"manual",signal:AbortSignal.timeout(timeout)});
    const raw=await response.text();
    if(response.status!==200){
      for(const m of ["A","B"])for(const role of ["customer","admin"])
        assert(!raw.includes(proof[m][role].id),"Error response leaked private fixture identity");
      return {status:response.status};
    }
    let data={};try{data=JSON.parse(raw)}catch{}
    return {status:200,id:data[actor==="customer"?"customer":"user"]?.id};
  }catch(e){
    if(["TimeoutError","AbortError"].includes(e?.name))return {status:"timeout"};
    if(e instanceof TypeError)return {status:"network"};
    throw new Error("Protected HTTP request classification failed");
  }
}
async function correctA(actor,cookie){
  const r=await request(9003,actor,cookie);
  assert.equal(r.status,200,"AOF session is not authenticated");
  assert.equal(r.id,proof.A[actor].id,"AOF session principal changed");
}
async function deniedB(actor){
  const r=await request(9003,actor,proof.B[actor].cookie);
  assert([401,403].includes(r.status),"B cookie accepted by tenant A");
}
async function bAlive(){
  assert.equal(await ping(6381),"+PONG");
  for(const actor of ["customer","admin"]){
    const r=await request(9001,actor,proof.B[actor].cookie,proof.B,proof.B.key);
    assert.equal(r.status,200,"B cookie rejected");
    assert.equal(r.id,proof.B[actor].id,"B identity mismatch");
  }
}
async function newAofCookie(actor){
  const kind=actor==="customer"?"customer":"user";
  const email=actor==="customer"?"shopper-a@shqipshop.example.invalid":"admin-a@shqipshop.example.invalid";
  const password=env[actor==="customer"?"SHQIPSHOP_A_CUSTOMER_PASSWORD":"SHQIPSHOP_A_ADMIN_PASSWORD"];
  assert(password?.length>=12);
  const login=await fetch(api+"9003/auth/"+kind+"/emailpass",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({email,password}),signal:AbortSignal.timeout(12000),
  });
  assert.equal(login.status,200,"Synthetic A login failed");
  const token=(await login.json()).token;assert(token?.length>20);
  const session=await fetch(api+"9003/auth/session",{
    method:"POST",headers:{authorization:"Bearer "+token},signal:AbortSignal.timeout(12000),
  });
  assert.equal(session.status,200,"Synthetic A cookie exchange failed");
  const cookie=(session.headers.getSetCookie?.()??[])
    .map(c=>c.split(";")[0]).find(c=>c.startsWith("connect.sid="));
  assert(cookie,"Missing synthetic A cookie");
  await correctA(actor,cookie);
  return cookie;
}
async function waitForRecovery(){
  const until=Date.now()+40000;
  while(Date.now()<until){
    try{if(await ping(6382,1200)==="+PONG")return;}catch{}
    await new Promise(r=>setTimeout(r,500));
  }
  throw new Error("New Redis container did not recover");
}
async function oldCookieAfterRecovery(actor,cookie){
  const until=Date.now()+30000;
  while(Date.now()<until){
    const r=await request(9003,actor,cookie,proof.A,proof.A.key,2800);
    if(r.status===200){
      assert.equal(r.id,proof.A[actor].id,"Restored cookie mapped to wrong principal");
      return;
    }
    assert([401,403,500,502,503,504,"timeout","network"].includes(r.status),
      "Unexpected identity status during reconnection");
    await new Promise(r=>setTimeout(r,550));
  }
  throw new Error("Existing cookie not restored from external AOF volume");
}
async function main(){
  phase="BASELINE";
  assert.equal(await ping(6382),"+PONG");
  assert.equal(await ping(6379),"+PONG");
  await bAlive();
  for(const actor of ["customer","admin"])await deniedB(actor);
  const saved={};
  for(const actor of ["customer","admin"])saved[actor]=await newAofCookie(actor);
  const sentinel="stage12t-ci-"+randomBytes(10).toString("hex");
  const secret=randomBytes(16).toString("hex");
  assert.equal(docker("exec",old,"redis-cli","--raw","SET",sentinel,secret,"EX","300"),"OK");
  assert.equal(docker("exec",old,"redis-cli","--raw","GET",sentinel),secret);
  console.log("SHQIPSHOP_226_STAGE12T_VOLUME_AOF_OLD_SESSION_AND_SENTINEL_READY");

  phase="DELETE_ONLY_OLD_CI_CONTAINER";
  docker("rm","-f",old);
  let unreachable=false;
  try{await ping(6382,900);}catch{unreachable=true;}
  assert(unreachable,"AOF hard outage was not observed");
  await bAlive();
  for(const actor of ["customer","admin"]){
    const r=await request(9003,actor,saved[actor],proof.A,proof.A.key,1800);
    assert([401,403,500,502,503,504,"timeout","network"].includes(r.status),
      "A protected identity was exposed during AOF container absence");
  }
  await bAlive();
  console.log("SHQIPSHOP_226_STAGE12T_OLD_CONTAINER_REMOVED_B_INDEPENDENT");

  phase="CREATE_NEW_CI_CONTAINER_SAME_VOLUME";
  docker("run","-d","--cidfile",cidfile,
    "--name","shqipshop-stage12t-"+env.GITHUB_RUN_ID,
    "--label","shqipshop.scope=stage12t-ci",
    "--mount","type=volume,source="+volume+",target=/data",
    "--network","bridge","-p","127.0.0.1:6382:6379",
    "redis:7-alpine","redis-server","--save","","--appendonly","yes","--appendfsync","always");
  const newer=readFileSync(cidfile,"utf8").trim();
  assert(newer!==old,"Replacement must be a distinct container");
  assertContainer(newer,"stage12t-ci");
  assert.equal(docker("inspect","--format","{{.State.Running}}",newer),"true");
  await waitForRecovery();
  assert.equal(docker("exec",newer,"redis-cli","--raw","GET",sentinel),secret,
    "Synthetic key did not survive container removal/replacement");
  assert.equal(docker("exec",newer,"redis-cli","--raw","CONFIG","GET","appendonly").split("\n").at(-1),"yes");
  console.log("SHQIPSHOP_226_STAGE12T_EXTERNAL_VOLUME_SENTINEL_SURVIVED_REPLACEMENT");

  phase="RECOVER_OLD_COOKIES";
  for(const actor of ["customer","admin"]){
    await oldCookieAfterRecovery(actor,saved[actor]);
    await deniedB(actor);
  }
  await bAlive();
  const anonymous=await request(9003,"customer",undefined);
  assert([401,403].includes(anonymous.status),"Anonymous cookie bypass");
  const roleMismatch=await request(9003,"admin",saved.customer);
  assert([401,403].includes(roleMismatch.status),"Customer cookie accepted on Admin route");
  console.log("SHQIPSHOP_226_STAGE12T_ORIGINAL_COOKIES_VALID_AND_FOREIGN_DENIED");

  phase="COOKIE_LOGOUT_INVALIDATION";
  const logout=await fetch(api+"9003/auth/session",{
    method:"DELETE",headers:{cookie:saved.customer},signal:AbortSignal.timeout(7000),
  });
  assert.equal(logout.status,200,"Cookie logout failed after AOF restore");
  const replay=await request(9003,"customer",saved.customer);
  assert([401,403].includes(replay.status),"Logged-out cookie survived server invalidation");
  await correctA("admin",saved.admin);
  await bAlive();
  console.log("SHQIPSHOP_226_STAGE12T_COOKIE_LOGOUT_REPLAY_DENIED_ADMIN_B_UNAFFECTED");

  phase="FRESH_AUTH";
  const newCustomer=await newAofCookie("customer");
  await correctA("customer",newCustomer);
  await deniedB("customer");
  const health=await fetch(api+"9003/health",{signal:AbortSignal.timeout(5000)});
  assert.equal(health.status,200);
  console.log("SHQIPSHOP_226_STAGE12T_REPLACEMENT_FRESH_AUTH_PASSED");
  console.log("SHQIPSHOP_226_STAGE12T_CI_ONLY_NO_BACKUP_HA_JWT_REVOCATION_CLAIM");

  // Stage 12U: the intentionally revoked customer cookie must not be
  // resurrected when AOF is replayed by a SECOND new Redis container.
  // Active A customer/Admin cookies must survive; B must remain independent.
  // The short-lived sentinel only tests Redis TTL, not session-cookie expiry.
  phase="STAGE12U_PRE_SECOND_REPLACEMENT";
  const cidfileU=join(temp,"shqipshop226-stage12u-third.cid");
  assert.equal(env.SHQIPSHOP_STAGE12U_THIRD_CIDFILE,cidfileU);
  assert(!existsSync(cidfileU),"Third CI container CID file must not preexist");
  assert.equal(docker("inspect","--format","{{.State.Running}}",newer),"true");
  assertContainer(newer,"stage12t-ci");
  await correctA("admin",saved.admin);
  await correctA("customer",newCustomer);
  const oldCookie=await request(9003,"customer",saved.customer);
  assert([401,403].includes(oldCookie.status),"Revoked cookie accepted before second replacement");
  const expiring="stage12u-expires-"+randomBytes(10).toString("hex");
  const expiringValue=randomBytes(12).toString("hex");
  assert.equal(docker("exec",newer,"redis-cli","--raw","SET",expiring,expiringValue,"EX","8"),"OK");
  assert.equal(docker("exec",newer,"redis-cli","--raw","GET",expiring),expiringValue);
  assert.equal(docker("exec",newer,"redis-cli","--raw","GET",sentinel),secret);
  console.log("SHQIPSHOP_226_STAGE12U_PRE_SECOND_REPLACEMENT_REVOCATION_AND_TTL_PASSED");

  phase="STAGE12U_REMOVE_SECOND_CONTAINER";
  docker("rm","-f",newer);
  let secondOutage=false;
  try { await ping(6382,800); } catch { secondOutage=true; }
  assert(secondOutage,"Second Redis outage was not observed");
  await bAlive();
  for (const actor of ["customer","admin"]) {
    const cookie=actor==="admin"?saved.admin:newCustomer;
    const r=await request(9003,actor,cookie,proof.A,proof.A.key,1700);
    assert([401,403,500,502,503,504,"timeout","network"].includes(r.status),
      "A private identity returned during second Redis replacement");
  }
  await bAlive();
  console.log("SHQIPSHOP_226_STAGE12U_SECOND_HARD_OUTAGE_B_STAYS_INDEPENDENT");

  phase="STAGE12U_NEW_CONTAINER_SAME_AOF_VOLUME";
  docker("run","-d","--cidfile",cidfileU,
    "--name","shqipshop-stage12u-"+env.GITHUB_RUN_ID,
    "--label","shqipshop.scope=stage12u-ci",
    "--mount","type=volume,source="+volume+",target=/data",
    "--network","bridge","-p","127.0.0.1:6382:6379",
    "redis:7-alpine","redis-server","--save","","--appendonly","yes","--appendfsync","always");
  const third=readFileSync(cidfileU,"utf8").trim();
  assert(third!==newer && third!==old,"A third, distinct Redis container is required");
  assertContainer(third,"stage12u-ci");
  assert.equal(docker("inspect","--format","{{.State.Running}}",third),"true");
  await waitForRecovery();
  assert.equal(docker("exec",third,"redis-cli","--raw","GET",sentinel),secret);
  console.log("SHQIPSHOP_226_STAGE12U_EXTERNAL_VOLUME_SURVIVED_SECOND_REPLACEMENT");

  phase="STAGE12U_ACTIVE_VS_REVOKED_COOKIE";
  await oldCookieAfterRecovery("admin",saved.admin);
  await oldCookieAfterRecovery("customer",newCustomer);
  // Wait for confirmed A Redis HTTP recovery before testing denial: 503 or
  // timeout must NOT masquerade as secure cookie invalidation.
  const revoked=await request(9003,"customer",saved.customer);
  assert([401,403].includes(revoked.status),
    "Previously logged-out cookie was resurrected after AOF replay");
  await deniedB("customer");
  await deniedB("admin");
  const wrongRole=await request(9003,"admin",newCustomer);
  assert([401,403].includes(wrongRole.status),
    "Active customer cookie wrongly accepted as Admin");
  await bAlive();
  console.log("SHQIPSHOP_226_STAGE12U_REVOKED_COOKIE_STAYS_DENIED_ACTIVE_A_B_SESSIONS_VALID");

  phase="STAGE12U_SYNTHETIC_TTL_EXPIRES";
  const ttlAtRecovery=Number(docker("exec",third,"redis-cli","--raw","PTTL",expiring));
  assert(Number.isInteger(ttlAtRecovery) && ttlAtRecovery<=8000 && ttlAtRecovery>=-2,
    "Synthetic TTL was reset or invalid after AOF replay");
  const expiryDeadline=Date.now()+11000;
  let expired=false;
  while (Date.now()<expiryDeadline) {
    if(docker("exec",third,"redis-cli","--raw","EXISTS",expiring)==="0") {
      expired=true;break;
    }
    await new Promise(resolve=>setTimeout(resolve,500));
  }
  assert(expired,"Short synthetic Redis TTL failed to expire");
  await correctA("admin",saved.admin);
  await correctA("customer",newCustomer);
  const stillRevoked=await request(9003,"customer",saved.customer);
  assert([401,403].includes(stillRevoked.status));
  await bAlive();
  console.log("SHQIPSHOP_226_STAGE12U_SYNTHETIC_REDIS_TTL_EXPIRED_NOT_COOKIE_TTL_CERTIFICATION");

  phase="STAGE12U_FRESH_SESSION_AFTER_SECOND_REPLACEMENT";
  const finalCookie=await newAofCookie("customer");
  await correctA("customer",finalCookie);
  await deniedB("customer");
  const healthy=await fetch(api+"9003/health",{signal:AbortSignal.timeout(5000)});
  assert.equal(healthy.status,200);
  console.log("SHQIPSHOP_226_STAGE12U_SECOND_REPLACEMENT_FRESH_LOGIN_PASSED");
  console.log("SHQIPSHOP_226_STAGE12U_CI_ONLY_NO_JWT_REVOCATION_OR_PRODUCTION_TTL_CLAIM");
}
main().catch(()=>{
  console.error("::error::SHQIPSHOP_226_STAGE12T_FAILED_AT_"+phase);
  process.exitCode=1;
});