/** Synthetic-only Redis event probe. No customer data, payments, or external I/O.
 * Registered inertly outside GitHub CI to avoid touching real commerce.
 */
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { writeFileSync } from "node:fs"
import { resolve, join } from "node:path"

export default async function verifySeparatedWorker({
  event,
}: SubscriberArgs<{ id: string }>) {
  if (
    process.env.CI !== "true" ||
    process.env.NODE_ENV !== "development" ||
    process.env.SHQIPSHOP_F07C_PROBE !== "true"
  ) return

  if (process.env.WORKER_MODE !== "worker") {
    throw new Error("F07c synthetic event processed outside a dedicated worker")
  }
  const id = event.data?.id
  if (id !== "first" && id !== "second") {
    throw new Error("Invalid synthetic F07c probe identifier")
  }
  const dir = process.env.SHQIPSHOP_F07C_PROOF_DIR
  const runnerTemp = process.env.RUNNER_TEMP
  if (!dir || !runnerTemp || resolve(dir) !== resolve(runnerTemp)) {
    throw new Error("F07c proof output must be in RUNNER_TEMP")
  }

  // Only the first synthetic event fails its first delivery. BullMQ must
  // retry this event before the success proof can be written.
  if (id === "first") {
    let firstAttempt = false
    try {
      writeFileSync(join(dir, "f07c-first-failure"), "first-attempt\n", {
        flag: "wx", mode: 0o600,
      })
      firstAttempt = true
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error
    }
    if (firstAttempt) throw new Error("Synthetic F07c transient failure (once)")
  }

  // wx makes a second successful delivery fail instead of silently being
  // counted as another success. Payload and logs contain no PII.
  writeFileSync(join(dir, `f07c-${id}-success`), String(process.pid) + "\n", {
    flag: "wx", mode: 0o600,
  })
  console.log(`SHQIPSHOP_F07C_DEDICATED_WORKER_${id.toUpperCase()}_CONSUMED`)
}

export const config: SubscriberConfig = {
  event: "shqipshop.f07c.synthetic",
}
