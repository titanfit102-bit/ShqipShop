import { F07G_QUOTE_REVIEW, N03_REGISTERED_RECOVERY } from '@env';
import { apiUrl } from '@api/client';
import type { CheckoutRecoveryScope } from './order-completion-recovery';

export const nativeCheckoutRecoveryEnabled =
  __DEV__ && N03_REGISTERED_RECOVERY === 'true';

export const nativeQuoteReviewEnabled = nativeCheckoutRecoveryEnabled && F07G_QUOTE_REVIEW === 'true';

export function nativeCheckoutRecoveryScope(customerId?: string | null): CheckoutRecoveryScope | undefined {
  if (!nativeCheckoutRecoveryEnabled || !customerId || !/^cus_[A-Za-z0-9_-]{8,}$/.test(customerId)) {
    return undefined;
  }
  return { backend: apiUrl, customerId };
}
