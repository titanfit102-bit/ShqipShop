/** Export a disposable CI publishable key for Store API tests. Never use with real merchants. */
import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { writeFileSync } from "node:fs"
import { createApiKeysWorkflow, createSalesChannelsWorkflow, linkSalesChannelsToApiKeyWorkflow } from "@medusajs/medusa/core-flows"

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

  // A separate sales channel contains no demo products. This tests
  // catalog scope only; sales channels alone are NOT tenant isolation.
  const scopedKeyFile = process.env.SHQIPSHOP_CI_EMPTY_CHANNEL_KEY_FILE
  if (!scopedKeyFile) throw new Error("Missing second publishable-key file")
  const { result: [emptyChannel] } = await createSalesChannelsWorkflow(container).run({
    input: { salesChannelsData: [{ name: "CI EMPTY CHANNEL — CATALOG SCOPE ONLY" }] }
  })
  const { result: [emptyKey] } = await createApiKeysWorkflow(container).run({
    input: { api_keys: [{ title: "CI catalog scope key", type: "publishable", created_by: "" }] }
  })
  await linkSalesChannelsToApiKeyWorkflow(container).run({
    input: { id: emptyKey.id, add: [emptyChannel.id] }
  })
  if (!emptyKey.token || typeof emptyKey.token !== "string") {
    throw new Error("CI scoped publishable key not returned by Medusa workflow")
  }
  writeFileSync(scopedKeyFile, emptyKey.token, { encoding: "utf8", mode: 0o600, flag: "wx" })
  console.log("SHQIPSHOP_CI_PUBLISHABLE_KEY_EXPORTED")
  console.log("SHQIPSHOP_CI_EMPTY_SALES_CHANNEL_CREATED")
}
