import assert from "node:assert/strict"
import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

// Both callers already require the fixed loopback CI database, Redis and
// fixture proof. A local run must also match the freshly created DB cluster.
export async function assertDisposableCandidate(container: ExecArgs["container"]) {
  assert.equal(process.env.CI, "true")
  assert.equal(process.env.NODE_ENV, "development")
  assert.equal(process.env.SHQIPSHOP_R01_REFUND_CANDIDATE_CI, "true")
  if (process.env.GITHUB_ACTIONS === "true") return

  const runId = process.env.SHQIPSHOP_R01_LOCAL_RUN_ID
  assert(runId && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(runId))
  const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const {rows: [row]} = await pg.raw(
    "select current_database() as db, current_user as role, current_setting('shqipshop.r01_run_id', true) as run_id"
  )
  assert.deepEqual(row, {db:"medusa_ci", role:"medusa_ci", run_id:runId})
}
