import type { HttpTypes } from '@medusajs/types';

export const REGION_STORAGE_KEY = 'region_id';

type RegionStorage = {
  getItem(key: string): Promise<string | null>;
};
type RegionApi = {
  retrieve(id: string): Promise<{ region: HttpTypes.StoreRegion }>;
  list(): Promise<{ regions: HttpTypes.StoreRegion[] }>;
};
type RestoredRegion = {
  region: HttpTypes.StoreRegion;
  shouldPersist: boolean;
};

export const isMissingRegionError = (error: unknown) => {
  if (!error || typeof error !== 'object') return false;
  const e = error as {
    status?: number;
    statusCode?: number;
    response?: { status?: number };
  };
  const status = e.status ?? e.statusCode ?? e.response?.status;
  return status === 404 || status === 410;
};

/**
 * Only a verified missing region (404/410) triggers a fallback. An offline,
 * unauthorized or server-error response must preserve the selected region ID.
 * Do not delete the old ID before the replacement has loaded successfully.
 */
export async function restoreSavedRegion(
  storage: RegionStorage,
  api: RegionApi,
): Promise<RestoredRegion> {
  const savedId = await storage.getItem(REGION_STORAGE_KEY);
  if (savedId) {
    try {
      const { region } = await api.retrieve(savedId);
      if (!region?.id) throw new Error('Region response was empty');
      return { region, shouldPersist: false };
    } catch (error) {
      if (!isMissingRegionError(error)) throw error;
    }
  }

  const { regions } = await api.list();
  const replacement = regions?.find(region => Boolean(region?.id));
  if (!replacement) throw new Error('No store region is available');
  return { region: replacement, shouldPersist: true };
}
