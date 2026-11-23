import type { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  activeProof, cartIdPattern, forbiddenCredentialMode, getN03GuestCheckoutCart, isN03GuestCi,
  jsonOnly, proofPattern, SEALED_BEFORE_DISPATCH, singleField, transitionN03Attempt,
} from "../../../../middlewares/n03-guest-ci"

/** Seal a disposable guest attempt before Medusa acquires its dispatch claim. */
export const POST = async (req: MedusaStoreRequest, res: MedusaResponse) => {
  res.setHeader("Cache-Control", "private, no-store")
  if (!isN03GuestCi()) return res.sendStatus(404)
  const token = req.headers["x-shqipshop-recovery-proof"]
  if (forbiddenCredentialMode(req) || typeof token !== "string" || !proofPattern.test(token)) {
    return res.sendStatus(404)
  }
  if (!jsonOnly(req) || !singleField(req.body, "cart_id") || !cartIdPattern.test(req.body.cart_id)) {
    return res.sendStatus(400)
  }

  try {
    const cartId = req.body.cart_id
    const cart = await getN03GuestCheckoutCart(req, cartId)
    if (!cart) return res.sendStatus(404)
    const db = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
    if (cart.order?.id) {
      const proof = await activeProof(db, cartId, token).first("cart_id")
      return res.sendStatus(proof ? 409 : 404)
    }
    const status = await transitionN03Attempt(db, cartId, token, SEALED_BEFORE_DISPATCH)
    if (status !== 200) return res.sendStatus(status)
    return res.status(200).json({ state: "no_order" })
  } catch {
    return res.sendStatus(503)
  }
}
