import type { HttpTypes } from '@medusajs/types';
import type { CheckoutStep } from '../types/checkout';

/** A price or total alone never proves that a payment was initiated. */
export const activeCheckoutPaymentSession = (cart?: HttpTypes.StoreCart) =>
  cart?.payment_collection?.payment_sessions?.find(
    session => session.status === 'pending' || session.status === 'authorized',
  );

export const checkoutResumeStep = (cart?: HttpTypes.StoreCart): CheckoutStep => {
  if (!cart?.shipping_address?.address_1 || !cart?.email) return 'address';
  if (!cart.shipping_methods?.some(method => method.shipping_option_id)) return 'delivery';
  if (!activeCheckoutPaymentSession(cart)) return 'payment';
  return 'review';
};
