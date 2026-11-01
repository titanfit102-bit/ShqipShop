/** F08 Stage 11D disposable Redis fault control; Node built-ins only.
 * Execute ONLY against 127.0.0.1:6379 with exact isolated CI flags.
 * No authentication, production URLs or user-data operations.
 */
import assert from "node:assert/strict"
import {createConnection} from "node:net"
for(const [name,value] of Object.entries({
 CI:"true",NODE_ENV:"development",SHQIPSHOP_F08_FAILURE_CI:"true",
 SHQIPSHOP_F08_MULTIPROC_CI:"true",SHQIPSHOP_REQUIRE_REDIS:"true",
 REDIS_URL:"redis://127.0.0.1:6379",
 DATABASE_URL:"postgres://medusa_ci:disposable_ci_password@127.0.0.1:5432/medusa_ci",
}))assert.equal(process.env[name],value)
const mode=process.argv[2]
assert(["ping","pause","unpause"].includes(mode))
const args=mode==="ping"?["PING"]:
 mode==="pause"?["CLIENT","PAUSE","10000","ALL"]:
 ["CLIENT","UNPAUSE"]
const resp="*"+args.length+"\r\n"+
 args.map(a=>"$"+Buffer.byteLength(a)+"\r\n"+a+"\r\n").join("")
const expected=mode==="ping"?"+PONG\r\n":"+OK\r\n"
await new Promise((resolve,reject)=>{
 const socket=createConnection({host:"127.0.0.1",port:6379})
 let result=""
 const fail=e=>{socket.destroy();reject(e)}
 socket.setTimeout(mode==="unpause"?15000:8000,
  ()=>fail(new Error("Disposable Redis control timed out")))
 socket.once("error",fail)
 socket.once("connect",()=>socket.write(resp))
 socket.on("data",b=>{
  result+=b.toString("utf8")
  if(result.includes("\r\n")){
   socket.end()
   if(result===expected)resolve()
   else reject(new Error("Unexpected Redis control response (no details logged)"))
  }
 })
 socket.once("end",()=>{
  if(result!==expected)reject(new Error("Redis control connection ended without expected reply"))
 })
})
console.log("SHQIPSHOP_F08_STAGE11D_REDIS_"+mode.toUpperCase()+"_CONFIRMED")
