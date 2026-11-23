import {
  ORDER_COMPLETION_PENDING_KEY,
  clearKnownOrderCompletion,
} from "../../native-medusa/app/data/order-completion-recovery.ts"

const cartPattern = /^cart_[A-Za-z0-9_-]{8,}$/
const orderPattern = /^order_[A-Za-z0-9_-]{8,}$/

/**
 * Dispose-only recovery action using the native pending-marker contract.
 * The caller binds storage and reads to the same merchant and principal.
 * There is no checkout or payment mutation on this action's interface.
 */
export function createCheckoutRecoveryClient({storage, readOutcome, readReceipt, discardCart, isCurrent}) {
  let inFlight

  async function reconcile() {
    try {
      if (!isCurrent()) return {state:"pending"}
      const cartId = await storage.getItem(ORDER_COMPLETION_PENDING_KEY)
      if (!isCurrent()) return {state:"pending"}
      if (cartId === null) return {state:"idle"}
      if (!cartPattern.test(cartId)) return {state:"pending"}

      const {status, data} = await readOutcome(cartId)
      if (!isCurrent() || status !== 200 || !data || typeof data !== "object") {
        return {state:"pending"}
      }
      const {state, order_id:orderId} = data
      if (state === "confirmed") {
        if (typeof orderId !== "string" || !orderPattern.test(orderId)) return {state:"pending"}
        const receipt = await readReceipt(orderId)
        if (!isCurrent() || receipt.status !== 200 || receipt.data?.order?.id !== orderId) {
          return {state:"pending"}
        }
      } else if (state !== "no_order" || Object.keys(data).length !== 1) {
        return {state:"pending"}
      }

      if (await storage.getItem(ORDER_COMPLETION_PENDING_KEY) !== cartId || !isCurrent()) {
        return {state:"pending"}
      }
      // Cleanup is idempotent. A restart between it and journal removal
      // can verify the same outcome and try cleanup again.
      await discardCart(cartId)
      if (!isCurrent()) return {state:"pending"}
      await clearKnownOrderCompletion(cartId, storage)
      if (!isCurrent()) return {state:"pending"}
      return state === "confirmed" ? {state, orderId} : {state}
    } catch {
      return {state:"pending"}
    }
  }

  return {
    recover() {
      inFlight ??= reconcile().finally(() => { inFlight = undefined })
      return inFlight
    },
  }
}
