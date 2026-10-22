/**
 * CI-only inventory invariant around one Medusa Store API checkout.
 * Order placement should reserve exactly one unit and leave physical
 * stocked quantity intact; this test does not prove shipment deduction.
 */
import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { readFileSync, writeFileSync } from "node:fs"

type Snapshot = {
  id: string
  inventoryItemId: string
  stocked: number
  reserved: number
}

function asNumber(value: unknown, label: string): number {
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new Error(`Invalid inventory ${label}`)
  }
  return number
}

export default async function assertInventory({ container }: ExecArgs) {
  if (process.env.CI !== "true" || process.env.NODE_ENV !== "development") {
    throw new Error("This inventory assertion runs only on a disposable CI database")
  }
  const file = process.env.SHQIPSHOP_CI_INVENTORY_SNAPSHOT
  const mode = process.env.SHQIPSHOP_CI_INVENTORY_MODE
  if (!file || !["before", "after"].includes(mode ?? "")) {
    throw new Error("Missing inventory snapshot path or mode")
  }
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "inventory_level",
    fields: ["id", "inventory_item_id", "stocked_quantity", "reserved_quantity"],
  })
  const levels: Snapshot[] = data.map((level) => ({
    id: String(level.id),
    inventoryItemId: String(level.inventory_item_id),
    stocked: asNumber(level.stocked_quantity, "stocked"),
    reserved: asNumber(level.reserved_quantity, "reserved"),
  })).sort((a, b) => a.id.localeCompare(b.id))

  if (!levels.length) {
    throw new Error("No seeded inventory levels were found")
  }

  if (mode === "before") {
    if (levels.some((level) => level.reserved !== 0)) {
      throw new Error("Fresh test database already contains inventory reservations")
    }
    writeFileSync(file, JSON.stringify(levels), { encoding: "utf8", mode: 0o600, flag: "wx" })
    console.log("SHQIPSHOP_INVENTORY_BASELINE_PASSED", JSON.stringify({ inventoryLevels: levels.length }))
    return
  }

  const original = JSON.parse(readFileSync(file, "utf8")) as Snapshot[]
  if (JSON.stringify(levels.map((v) => v.id)) !== JSON.stringify(original.map((v) => v.id))) {
    throw new Error("Inventory level set changed unexpectedly during checkout")
  }
  let reservedDelta = 0
  for (let i = 0; i < levels.length; i++) {
    const prev = original[i]
    const next = levels[i]
    if (prev.inventoryItemId !== next.inventoryItemId || prev.stocked !== next.stocked) {
      throw new Error("Physical inventory stock or inventory identity changed during order placement")
    }
    if (next.reserved < prev.reserved) {
      throw new Error("Reserved inventory decreased during checkout")
    }
    reservedDelta += next.reserved - prev.reserved
  }
  if (reservedDelta !== 1) {
    throw new Error(`Expected one newly reserved unit, got ${reservedDelta}`)
  }
  console.log("SHQIPSHOP_INVENTORY_RESERVATION_PASSED", JSON.stringify({ reservedDelta, stockPreserved: true }))
}
