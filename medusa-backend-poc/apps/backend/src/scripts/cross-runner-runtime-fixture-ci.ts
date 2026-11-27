/** Associate one generated image with a product in the disposable recovery fixture. */
import assert from "node:assert/strict"
import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"

export default async function fixture({ container }: ExecArgs) {
  assert.equal(process.env.CI, "true")
  assert.equal(process.env.NODE_ENV, "development")
  assert.equal(process.env.DATABASE_URL,
    "postgres://medusa_ci:disposable_ci_password@127.0.0.1:5432/medusa_restore_fixture")

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: products } = await query.graph({
    entity: "product", fields: ["id"], filters: { title: "Medusa Shorts" },
  })
  assert.equal(products.length, 1)
  await updateProductsWorkflow(container).run({
    input: { products: [{
      id: products[0].id,
      images: [{ url: "http://127.0.0.1:9000/static/medusa-restore-fixture.png" }],
    }] },
  })
}
