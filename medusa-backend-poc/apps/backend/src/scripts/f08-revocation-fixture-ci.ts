import assert from "node:assert/strict"
import type {ExecArgs} from "@medusajs/framework/types"
import {ContainerRegistrationKeys} from "@medusajs/framework/utils"
import {F08_CI_TABLE,isF08DisposableCi} from "../api/middlewares/f08-revocation-ci"

/** Ephemeral PostgreSQL table lifecycle; never a Medusa production migration. */
export default async function run({container}:ExecArgs){
  assert(isF08DisposableCi(),"F08 table forbidden outside exact localhost CI")
  const action=process.env.SHQIPSHOP_F08_CI_FIXTURE_ACTION
  assert(["create","drop"].includes(action??""))
  const db:any=container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const exists=await db.schema.hasTable(F08_CI_TABLE)
  if(action==="create"){
    assert(!exists,"F08 CI fixture must not overwrite a table")
    await db.schema.createTable(F08_CI_TABLE,(t:any)=>{
      t.string("token_sha256",64).primary()
      t.string("customer_id",120).notNullable()
      t.timestamp("revoked_at").notNullable().defaultTo(db.fn.now())
    })
    console.log("SHQIPSHOP_F08_DISPOSABLE_REVOCATION_TABLE_CREATED")
  }else{
    assert(exists,"F08 CI revocation fixture missing at cleanup")
    await db.schema.dropTable(F08_CI_TABLE)
    console.log("SHQIPSHOP_F08_DISPOSABLE_REVOCATION_TABLE_DROPPED")
  }
}
