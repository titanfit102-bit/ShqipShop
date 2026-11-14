/**
 * N03 — local fail-closed checkout completion journal (not proof of an order).
 * An unknown HTTP outcome must NEVER cause a second complete() request.
 */
export const ORDER_COMPLETION_PENDING_KEY = 'shqipshop:order-completion-pending';
export const ORDER_COMPLETION_PENDING_MESSAGE =
  'Order confirmation pending; do not submit again until the order is verified';

export type OrderCompletionStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

// Reserve before the first awaited storage operation; two taps cannot
// submit parallel requests in the same JS process.
const reservedStorages = new WeakSet<OrderCompletionStorage>();

export async function reserveOrderCompletion(
  cartId: string,
  storage: OrderCompletionStorage,
): Promise<void> {
  if (!cartId || reservedStorages.has(storage)) {
    throw new Error(ORDER_COMPLETION_PENDING_MESSAGE);
  }
  reservedStorages.add(storage);
  // An ambiguous write/read never releases the in-memory reservation.
  const pending = await storage.getItem(ORDER_COMPLETION_PENDING_KEY);
  if (pending !== null) throw new Error(ORDER_COMPLETION_PENDING_MESSAGE);
  await storage.setItem(ORDER_COMPLETION_PENDING_KEY, cartId);
  const verified = await storage.getItem(ORDER_COMPLETION_PENDING_KEY);
  if (verified !== cartId) {
    throw new Error('Order completion marker could not be verified');
  }
}

/** Clear ONLY on explicit no-order result or verified receipt + cart cleanup. */
export async function clearKnownOrderCompletion(
  cartId: string,
  storage: OrderCompletionStorage,
): Promise<void> {
  const pending = await storage.getItem(ORDER_COMPLETION_PENDING_KEY);
  if (pending !== cartId) throw new Error(ORDER_COMPLETION_PENDING_MESSAGE);
  await storage.removeItem(ORDER_COMPLETION_PENDING_KEY);
  reservedStorages.delete(storage);
}
