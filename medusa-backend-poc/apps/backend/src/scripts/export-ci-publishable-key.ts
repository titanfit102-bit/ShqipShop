/** Export a disposable CI publishable key for Store API tests. Never use with real merchants. */
import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { writeFileSync } from "node:fs"

export default async function exportCiKey({ container }: ExecArgs) {
  if (process.env.CI !== "true" || process.env.NODE_ENV !== "development") {
    throw new Error("Export of demo API key is allowed only in isolated CI development")
  }
  const outputFile = process.env.SHQIPSHOP_CI_PUBLISHABLE_KEY_FILE
  if (!outputFile) throw new Error("Missing temporary key path")
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: keys } = await query.graph({
    entity: "api_key",
    fields: ["id", "title", "type", "token", "revoked_at"],
  })
  const key = keys.find((item) =>
    item.type === "publishable" &&
    item.title === "Default Publishable API Key" &&
    !item.revoked_at &&
    item.token
  )
  if (!key?.token) throw new Error("Seeded publishable key unavailable")
  writeFileSync(outputFile, key.token, { encoding: "utf8", mode: 0o600, flag: "wx" })
  console.log("SHQIPSHOP_CI_PUBLISHABLE_KEY_EXPORTED")
}
