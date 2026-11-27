import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { cartIdPattern, jsonOnly, SEALED_BEFORE_DISPATCH, singleField } from "../../../../middlewares/n03-guest-ci"
import { isN03RegisteredCi, transitionN03RegisteredAttempt } from "../../../../middlewares/n03-registered-ci"

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  res.setHeader("Cache-Control", "private, no-store")
  if (!isN03RegisteredCi()) return res.sendStatus(404)
  if (!jsonOnly(req) || !singleField(req.body, "cart_id") || !cartIdPattern.test(req.body.cart_id)) {
    return res.sendStatus(400)
  }
  try {
    const status = await transitionN03RegisteredAttempt(req, req.body.cart_id, SEALED_BEFORE_DISPATCH)
    if (status !== 200) return res.sendStatus(status)
    return res.status(200).json({ state:"no_order" })
  } catch {
    return res.sendStatus(503)
  }
}
