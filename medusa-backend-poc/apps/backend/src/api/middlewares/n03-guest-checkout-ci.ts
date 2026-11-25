import type { AuthenticatedMedusaRequest, MedusaNextFunction, MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"
import { authenticate } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  ATTEMPT_TABLE, DISPATCH_CLAIMED, forbiddenCredentialMode, getN03GuestCheckoutCart,
  GUEST_TABLE, isN03GuestCi, proofPattern, transitionN03Attempt,
} from "./n03-guest-ci"
import { isN03RegisteredCi, transitionN03RegisteredAttempt } from "./n03-registered-ci"

const authenticateBuyer = authenticate("customer", ["bearer"])

/** Commit one dispatch claim before allowing the built-in Medusa checkout to run. */
export async function claimN03CheckoutCi(
  req: AuthenticatedMedusaRequest & MedusaStoreRequest,
  res: MedusaResponse,
  next: MedusaNextFunction,
) {
  const guestEnabled = isN03GuestCi()
  const registeredEnabled = isN03RegisteredCi()
  if (!guestEnabled && !registeredEnabled) return next()

  const path = String(req.originalUrl ?? req.path ?? "").split("?")[0]
  const cartId = /^\/store\/carts\/(cart_[A-Za-z0-9_-]{8,})\/complete\/?$/.exec(path)?.[1]
  if (!cartId || (req.params?.id && req.params.id !== cartId)) return res.sendStatus(404)

  try {
    const db: any = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
    if (registeredEnabled) {
      const attempt = await db(ATTEMPT_TABLE).where({ cart_id: cartId }).first("owner_customer_id")
      if (attempt?.owner_customer_id != null) {
        res.setHeader("Cache-Control", "private, no-store")
        return authenticateBuyer(req, res, async (error?: Error) => {
          if (error) return next(error)
          try {
            const status = await transitionN03RegisteredAttempt(req, cartId, DISPATCH_CLAIMED)
            if (status !== 200) return res.sendStatus(status)
            return next()
          } catch {
            return res.sendStatus(503)
          }
        })
      }
    }
    if (!guestEnabled) return next()
    const capability = await db(GUEST_TABLE).where({ cart_id: cartId }).first("cart_id")
    if (!capability) return next()
    res.setHeader("Cache-Control", "private, no-store")

    const token = req.headers["x-shqipshop-recovery-proof"]
    if (forbiddenCredentialMode(req) || typeof token !== "string" || !proofPattern.test(token)) {
      return res.sendStatus(404)
    }
    if (!await getN03GuestCheckoutCart(req, cartId)) return res.sendStatus(404)
    const status = await transitionN03Attempt(db, cartId, token, DISPATCH_CLAIMED)
    if (status !== 200) return res.sendStatus(status)
  } catch {
    return res.sendStatus(503)
  }

  return next()
}
