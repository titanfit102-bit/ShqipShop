/** Only synthetic event emission in isolated CI; never run against real tenants. */
import type { ExecArgs, IEventBusModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

export default async function emitF07c({ container, args }: ExecArgs) {
  if (
    process.env.CI !== "true" ||
    process.env.NODE_ENV !== "development" ||
    process.env.SHQIPSHOP_F07C_PROBE !== "true" ||
    process.env.SHQIPSHOP_REQUIRE_REDIS !== "true" ||
    process.env.WORKER_MODE !== "server"
  ) throw new Error("F07c emission is restricted to CI server-only Redis mode")

  const id = args?.[0]
  if (id !== "first" && id !== "second" && id !== "outage") {
    throw new Error("Invalid F07c synthetic event")
  }
  const eventBus = container.resolve<IEventBusModuleService>(Modules.EVENT_BUS)
  await eventBus.emit(
    { name: "shqipshop.f07c.synthetic", data: { id } },
    { attempts: 2, backoff: { type: "fixed", delay: 1000 } }
  )
  console.log(`SHQIPSHOP_F07C_${id.toUpperCase()}_QUEUED`)
}
