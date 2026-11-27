import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { createCartWorkflow } from "@medusajs/medusa/core-flows"
import { randomUUID } from "node:crypto"
import {
  ATTEMPT_TABLE, cartIdPattern, DISPATCH_CLAIMED, hasN03CartChannel,
  jsonOnly, SEALED_BEFORE_DISPATCH, singleField,
} from "../../../middlewares/n03-guest-ci"
import {
  isN03RegisteredCi, registeredActor, isN03RegisteredCustomer,
} from "../../../middlewares/n03-registered-ci"

const regionPattern = /^reg_[A-Za-z0-9_-]{8,}$/
const channelPattern = /^sc_[A-Za-z0-9_-]{8,}$/
const orderPattern = /^order_[A-Za-z0-9_-]{8,}$/

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  res.setHeader("Cache-Control", "private, no-store, max-age=0")
  res.setHeader("Pragma", "no-cache")
  if (!isN03RegisteredCi()) return res.sendStatus(404)
  const actorId = registeredActor(req)
  if (!actorId) return res.sendStatus(401)

  const cartId = req.query?.cart_id
  if (typeof cartId !== "string" || !cartIdPattern.test(cartId) ||
      Object.keys(req.query ?? {}).length !== 1) {
    return res.sendStatus(404)
  }

  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data: carts } = await query.graph({
      entity: "cart",
      fields: ["id", "customer_id", "order.id", "sales_channel_id"],
      filters: { id: cartId },
    })
    if (carts.length !== 1 || carts[0].id !== cartId ||
        carts[0].customer_id !== actorId) return res.sendStatus(404)

    if (!await isN03RegisteredCustomer(req, actorId)) return res.sendStatus(404)
    const db: any = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
    const attempt = await db(ATTEMPT_TABLE).where({ cart_id: cartId }).first("phase", "owner_customer_id")
    const tracked = attempt?.owner_customer_id != null
    if (tracked && (attempt.owner_customer_id !== actorId ||
        !hasN03CartChannel(req, carts[0].sales_channel_id))) return res.sendStatus(404)

    const linkedOrderId = carts[0].order?.id
    if (linkedOrderId == null) {
      const sealed = tracked && attempt.phase === SEALED_BEFORE_DISPATCH
      return res.status(200).json({ state: sealed ? "no_order" : "unknown" })
    }
    if (tracked && attempt.phase !== DISPATCH_CLAIMED) {
      return res.status(200).json({ state: "unknown" })
    }
    if (typeof linkedOrderId !== "string" || !orderPattern.test(linkedOrderId)) {
      return res.sendStatus(503)
    }

    const { data: orders } = await query.graph({
      entity: "order",
      fields: ["id", "customer_id", "cart.id"],
      filters: { id: linkedOrderId },
    })
    if (orders.length !== 1 || orders[0].id !== linkedOrderId ||
        orders[0].customer_id !== actorId || orders[0].cart?.id !== cartId) {
      // Broken link / stale read: do not assert a negative outcome.
      return res.sendStatus(503)
    }
    return res.status(200).json({ state: "confirmed", order_id: linkedOrderId })
  } catch {
    // No account/tenant/order identifiers or SQL errors leave the response.
    return res.sendStatus(503)
  }
}

/** Create a new registered cart and bind its checkout attempt before revealing its ID. */
export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  res.setHeader("Cache-Control", "private, no-store")
  if (!isN03RegisteredCi()) return res.sendStatus(404)
  const actor = registeredActor(req)
  if (!actor) return res.sendStatus(401)
  if (!jsonOnly(req) || !singleField(req.body, "region_id") || !regionPattern.test(req.body.region_id)) {
    return res.sendStatus(400)
  }
  const channels = req.publishable_key_context?.sales_channel_ids
  if (channels?.length !== 1 || !channelPattern.test(channels[0])) return res.sendStatus(404)

  try {
    if (!await isN03RegisteredCustomer(req, actor)) return res.sendStatus(404)
    const { result: cart } = await createCartWorkflow(req.scope).run({
      input: { region_id: req.body.region_id, sales_channel_id: channels[0], customer_id: actor },
    })
    if (!cart?.id || !cartIdPattern.test(cart.id) || cart.customer_id !== actor) {
      return res.sendStatus(503)
    }
    const db: any = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
    await db(ATTEMPT_TABLE).insert({
      attempt_id: randomUUID(), cart_id: cart.id, owner_customer_id: actor,
    })
    return res.status(201).json({ cart_id: cart.id })
  } catch {
    return res.sendStatus(503)
  }
}
