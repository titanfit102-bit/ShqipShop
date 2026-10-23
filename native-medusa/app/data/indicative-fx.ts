import { useQuery } from '@tanstack/react-query';
import { PUBLISHABLE_API_KEY } from '@env';
import { apiUrl } from '@api/client';
import {
  type FxResponse,
  isUsableFxQuote,
} from '@utils/dual-currency';

const backendUrl = typeof apiUrl === 'string' && apiUrl.length > 0
  ? apiUrl
  : 'http://localhost:9000';
const fxEndpoint = `${backendUrl.replace(/\/$/, '')}/store/shqipshop/indicative-fx`;

/**
 * Same query/cache for every product card; never falls back to an invented rate.
 * Quote is informational and must not be used for actual payment totals.
 */
export const useIndicativeFx = () =>
  useQuery<FxResponse>({
    queryKey: ['shqipshop', 'indicative-fx'],
    queryFn: async () => {
      const response = await fetch(fxEndpoint, {
        headers: PUBLISHABLE_API_KEY
          ? { 'x-publishable-api-key': PUBLISHABLE_API_KEY }
          : {},
      });
      if (!response.ok) return { available: false };
      const data = (await response.json()) as FxResponse;
      return isUsableFxQuote(data) ? data : { available: false };
    },
    retry: false,
    staleTime: 15 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
