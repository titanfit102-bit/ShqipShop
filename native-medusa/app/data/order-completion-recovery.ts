/**
 * N03 — local fail-closed checkout completion journal (not proof of an order).
 * An unknown HTTP outcome must NEVER cause a second complete() request.
 */
export const ORDER_COMPLETION_PENDING_KEY = 'shqipshop:order-completion-pending';
export const ORDER_COMPLETION_PENDING_MESSAGE =
  'Order confirmation pending; do not submit again until the order is verified';

export type CheckoutRecoveryScope = { backend: string; customerId: string };

const cartPattern = /^cart_[A-Za-z0-9_-]{8,}$/;
const orderPattern = /^order_[A-Za-z0-9_-]{8,}$/;

const encodeMarker = (cartId: string, scope?: CheckoutRecoveryScope) =>
  scope ? JSON.stringify({ cartId, backend: scope.backend, customerId: scope.customerId }) : cartId;

function recoverableCartId(marker: string, scope?: CheckoutRecoveryScope) {
  if (!scope) return cartPattern.test(marker) ? marker : undefined;
  const record = JSON.parse(marker);
  const cartId = record?.cartId;
  if (typeof cartId === 'string' && cartPattern.test(cartId) &&
      marker === encodeMarker(cartId, scope)) return cartId;
}

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
  scope?: CheckoutRecoveryScope,
): Promise<void> {
  if (!cartId || reservedStorages.has(storage)) {
    throw new Error(ORDER_COMPLETION_PENDING_MESSAGE);
  }
  reservedStorages.add(storage);
  // An ambiguous write/read never releases the in-memory reservation.
  const pending = await storage.getItem(ORDER_COMPLETION_PENDING_KEY);
  if (pending !== null) throw new Error(ORDER_COMPLETION_PENDING_MESSAGE);
  const marker = encodeMarker(cartId, scope);
  await storage.setItem(ORDER_COMPLETION_PENDING_KEY, marker);
  const verified = await storage.getItem(ORDER_COMPLETION_PENDING_KEY);
  if (verified !== marker) {
    throw new Error('Order completion marker could not be verified');
  }
}

/** Clear ONLY on explicit no-order result or verified receipt + cart cleanup. */
export async function clearKnownOrderCompletion(
  cartId: string,
  storage: OrderCompletionStorage,
  scope?: CheckoutRecoveryScope,
  isCurrent = () => true,
): Promise<void> {
  const pending = await storage.getItem(ORDER_COMPLETION_PENDING_KEY);
  if (pending !== encodeMarker(cartId, scope) || !isCurrent()) {
    throw new Error(ORDER_COMPLETION_PENDING_MESSAGE);
  }
  await storage.removeItem(ORDER_COMPLETION_PENDING_KEY);
  reservedStorages.delete(storage);
}

export type CheckoutRecoveryResult =
  | { state: 'pending' | 'idle' | 'no_order' }
  | { state: 'confirmed'; orderId: string };

type RecoveryRead = { status: number; data: unknown };
type RecoveryClientOptions = {
  storage: OrderCompletionStorage;
  scope?: CheckoutRecoveryScope;
  readOutcome: (cartId: string) => Promise<RecoveryRead>;
  readReceipt: (orderId: string) => Promise<RecoveryRead>;
  discardCart: (cartId: string) => Promise<void>;
  isCurrent: () => boolean;
};

/** Reconcile exactly one journal with read-only server results. */
export function createCheckoutRecoveryClient({
  storage, scope, readOutcome, readReceipt, discardCart, isCurrent,
}: RecoveryClientOptions) {
  let inFlight: Promise<CheckoutRecoveryResult> | undefined;

  async function reconcile(): Promise<CheckoutRecoveryResult> {
    try {
      if (!isCurrent()) return { state: 'pending' };
      const marker = await storage.getItem(ORDER_COMPLETION_PENDING_KEY);
      if (!isCurrent()) return { state: 'pending' };
      if (marker === null) return { state: 'idle' };
      const cartId = recoverableCartId(marker, scope);
      if (!cartId) return { state: 'pending' };

      const { status, data } = await readOutcome(cartId);
      if (!isCurrent() || status !== 200 || !data || typeof data !== 'object') {
        return { state: 'pending' };
      }
      const { state, order_id: orderId } = data as { state?: unknown; order_id?: unknown };
      let result: CheckoutRecoveryResult;
      if (state === 'confirmed') {
        if (typeof orderId !== 'string' || !orderPattern.test(orderId)) {
          return { state: 'pending' };
        }
        const receipt = await readReceipt(orderId);
        const returned = receipt.data as { order?: { id?: unknown } } | null;
        if (!isCurrent() || receipt.status !== 200 || returned?.order?.id !== orderId) {
          return { state: 'pending' };
        }
        result = { state, orderId };
      } else if (state === 'no_order' && Object.keys(data).length === 1) {
        result = { state };
      } else {
        return { state: 'pending' };
      }

      if (await storage.getItem(ORDER_COMPLETION_PENDING_KEY) !== marker || !isCurrent()) {
        return { state: 'pending' };
      }
      // A restart between cart cleanup and marker removal can retry cleanup.
      await discardCart(cartId);
      if (!isCurrent()) return { state: 'pending' };
      await clearKnownOrderCompletion(cartId, storage, scope, isCurrent);
      return isCurrent() ? result : { state: 'pending' };
    } catch {
      return { state: 'pending' };
    }
  }

  return {
    recover() {
      inFlight ??= reconcile().finally(() => { inFlight = undefined; });
      return inFlight;
    },
  };
}
