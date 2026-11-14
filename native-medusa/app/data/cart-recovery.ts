import type { HttpTypes } from '@medusajs/types';
import {
  ORDER_COMPLETION_PENDING_KEY,
  ORDER_COMPLETION_PENDING_MESSAGE,
} from './order-completion-recovery';

type CartStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};
type CartService = {
  retrieve(id: string, query: { fields: string }): Promise<{ cart: HttpTypes.StoreCart }>;
  create(data: { region_id: string }): Promise<{ cart: HttpTypes.StoreCart }>;
  update(id: string, data: { region_id: string }, query: { fields: string }): Promise<{ cart: HttpTypes.StoreCart }>;
};

export const CART_STORAGE_KEY = 'cart_id';
export const CART_RESET_PENDING_KEY = 'shqipshop:cart-reset-pending';
export const CART_FIELDS = '+shipping_methods.name,+payment_collection.payment_sessions';

export const isMissingCartError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  const e = error as {
    status?: number; statusCode?: number;
    response?: { status?: number }; message?: string;
  };
  const code = e.status ?? e.statusCode ?? e.response?.status;
  return code === 404 || code === 410 ||
    (code == null && /\b(?:404|410)\b/.test(e.message ?? ''));
};

/**
 * Expired carts are replaced only on confirmed 404/410. Network/offline,
 * invalid credentials and 5xx errors are propagated without discarding the
 * original cart ID or the shopper's locally persisted recovery point.
 */
export async function restoreOrCreateCart(
  regionId: string,
  storage: CartStorage,
  service: CartService,
): Promise<HttpTypes.StoreCart> {
  // A missing cart or 404/410 after complete() does not prove no order was
  // created. Fail closed across app restart until authoritative reconciliation.
  if (await storage.getItem(ORDER_COMPLETION_PENDING_KEY) !== null) {
    throw new Error(ORDER_COMPLETION_PENDING_MESSAGE);
  }
  // A prior logout/reset may have failed after persisting the tombstone.
  // Never read an old private cart until its persisted ID has been deleted.
  const resetPending = await storage.getItem(CART_RESET_PENDING_KEY);
  if (resetPending !== null) {
    await storage.removeItem(CART_STORAGE_KEY);
    await storage.removeItem(CART_RESET_PENDING_KEY);
  }
  const savedId = await storage.getItem(CART_STORAGE_KEY);
  if (savedId) {
    try {
      const { cart } = await service.retrieve(savedId, { fields: CART_FIELDS });
      if (cart.region_id === regionId) return cart;
      const updated = await service.update(savedId, { region_id: regionId }, { fields: CART_FIELDS });
      return updated.cart;
    } catch (error) {
      if (!isMissingCartError(error)) throw error;
      await storage.removeItem(CART_STORAGE_KEY);
    }
  }
  const { cart } = await service.create({ region_id: regionId });
  await storage.setItem(CART_STORAGE_KEY, cart.id);
  return cart;
}
