import { QueryClient } from '@tanstack/react-query';
import { apiUrl } from '@api/client';

/**
 * Customer-private data must never be shared across signed-in identities.
 * The backend URL is part of the key so future merchant/backend switching is
 * also isolated. No JWT, email, or other PII is stored in query keys.
 */
export const PRIVATE_CUSTOMER_QUERY_ROOT = 'private-customer';

export const privateCustomerQueryKey = (
  customerId: string | undefined,
  resource: 'addresses' | 'orders' | 'order-detail',
  ...ids: string[]
) =>
  [
    PRIVATE_CUSTOMER_QUERY_ROOT,
    apiUrl,
    customerId ?? 'guest',
    resource,
    ...ids,
  ] as const;

/** Clear even legacy cache keys that predate the isolation fix (F01). */
export const isPrivateCustomerQuery = (queryKey: readonly unknown[]): boolean =>
  queryKey[0] === PRIVATE_CUSTOMER_QUERY_ROOT ||
  queryKey[0] === 'address-list' ||
  queryKey[0] === 'orders' ||
  queryKey[0] === 'order';

/**
 * Cancel active private requests before dropping cached personal data.
 * React Query discards results of cancelled requests even when a transport
 * cannot abort the underlying HTTP operation.
 */
export const clearPrivateCustomerQueries = async (queryClient: QueryClient) => {
  const predicate = ({ queryKey }: { queryKey: readonly unknown[] }) =>
    isPrivateCustomerQuery(queryKey);

  await queryClient.cancelQueries({ predicate });
  queryClient.removeQueries({ predicate });
};
