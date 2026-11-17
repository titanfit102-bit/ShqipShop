/** Disposable GitHub CI only: verify Medusa Redis locking serializes two
 * independent CLI processes, with observable critical-section side effects.
 * Neither real orders nor production Redis are accessed.
 */
import type { ExecArgs, ILockingModule } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { existsSync, writeFileSync, unlinkSync } from "node:fs"
import { join, resolve } from "node:path"
import { setTimeout as sleep } from "node:timers/promises"

export default async function f07cLockProof({ container, args }: ExecArgs) {
  if (
    process.env.CI !== "true" ||
    process.env.NODE_ENV !== "development" ||
    process.env.SHQIPSHOP_F07C_PROBE !== "true" ||
    process.env.SHQIPSHOP_REQUIRE_REDIS !== "true" ||
    process.env.WORKER_MODE !== "server" ||
    process.env.REDIS_URL !== "redis://127.0.0.1:6379"
  ) throw new Error("F07c locking proof requires isolated GitHub CI Redis")
  const dir = process.env.SHQIPSHOP_F07C_PROOF_DIR
  if (!dir || !process.env.RUNNER_TEMP || resolve(dir) !== resolve(process.env.RUNNER_TEMP)) {
    throw new Error("Only runner temp may hold F07c proof output")
  }
  const role = args?.[0]
  if (role !== "holder" && role !== "contender") throw new Error("Invalid proof role")

  const file = (name: string) => join(dir, "f07c-lock-" + name)
  const record = (name: string) => writeFileSync(file(name), String(process.pid) + "\n", {
    flag: "wx", mode: 0o600,
  })
  const locking = container.resolve<ILockingModule>(Modules.LOCKING)
  if (role === "contender") record("contender-ready")

  await locking.execute(
    "shqipshop:f07c:synthetic:exclusive",
    async () => {
      if (role === "holder") {
        record("critical")
        record("holder-entered")
        let released = false
        for (let i = 0; i < 240; i++) {
          if (existsSync(file("release-request"))) { released = true; break }
          await sleep(250)
        }
        if (!released) throw new Error("CI test never signalled release")
        unlinkSync(file("critical"))
        record("holder-left")
        return
      }
      if (existsSync(file("critical"))) {
        throw new Error("F07c Redis lock broken: simultaneous critical sections")
      }
      record("contender-entered")
    },
    { timeout: 90, expire: 120 },
  )
  console.log("SHQIPSHOP_F07C_LOCK_" + role.toUpperCase() + "_PASSED")
}
