import type { HttpTypes } from '@medusajs/types';
import { REGION_STORAGE_KEY, restoreSavedRegion } from '../app/data/region-recovery';

const region = (id: string) => ({ id, name: id }) as HttpTypes.StoreRegion;
function fixture(saved: string | null) {
  const storage = { getItem: jest.fn(async (_key: string) => saved) };
  const api = {
    retrieve: jest.fn(async (id: string) => ({ region: region(id) })),
    list: jest.fn(async () => ({ regions: [region('reg_default')] })),
  };
  return { storage, api };
}

test('restores a valid saved region without selecting a new one', async () => {
  const f = fixture('reg_saved');
  expect(await restoreSavedRegion(f.storage, f.api)).toEqual({
    region: region('reg_saved'), shouldPersist: false,
  });
  expect(f.storage.getItem).toHaveBeenCalledWith(REGION_STORAGE_KEY);
  expect(f.api.list).not.toHaveBeenCalled();
});

test('selects and persists a default only when there is no saved region', async () => {
  const f = fixture(null);
  expect(await restoreSavedRegion(f.storage, f.api)).toEqual({
    region: region('reg_default'), shouldPersist: true,
  });
  expect(f.api.retrieve).not.toHaveBeenCalled();
});

test.each([404, 410])('stale region %d falls back to a listed region', async status => {
  const f = fixture('reg_expired');
  f.api.retrieve.mockRejectedValueOnce({ status });
  const result = await restoreSavedRegion(f.storage, f.api);
  expect(result.region.id).toBe('reg_default');
  expect(result.shouldPersist).toBe(true);
  expect(f.api.list).toHaveBeenCalledTimes(1);
});

test.each([401, 500, 503])('region retrieval error %d does not replace saved region', async status => {
  const f = fixture('reg_saved');
  f.api.retrieve.mockRejectedValueOnce({ status });
  await expect(restoreSavedRegion(f.storage, f.api)).rejects.toMatchObject({ status });
  expect(f.api.list).not.toHaveBeenCalled();
});

test('offline region retrieval preserves saved ID for retry', async () => {
  const f = fixture('reg_saved');
  f.api.retrieve.mockRejectedValueOnce(new Error('offline'));
  await expect(restoreSavedRegion(f.storage, f.api)).rejects.toThrow('offline');
  expect(f.api.list).not.toHaveBeenCalled();
});

test('failed fallback is not misreported as a new default region', async () => {
  const f = fixture('reg_expired');
  f.api.retrieve.mockRejectedValueOnce({ status: 404 });
  f.api.list.mockRejectedValueOnce(new Error('Network unavailable'));
  await expect(restoreSavedRegion(f.storage, f.api)).rejects.toThrow('Network unavailable');
});

test('empty region list fails clearly instead of selecting undefined', async () => {
  const f = fixture(null);
  f.api.list.mockResolvedValueOnce({ regions: [] });
  await expect(restoreSavedRegion(f.storage, f.api)).rejects.toThrow('No store region');
});

test('invalid successful response does not silently overwrite selection', async () => {
  const f = fixture('reg_saved');
  f.api.retrieve.mockResolvedValueOnce({ region: undefined as unknown as HttpTypes.StoreRegion });
  await expect(restoreSavedRegion(f.storage, f.api)).rejects.toThrow('empty');
  expect(f.api.list).not.toHaveBeenCalled();
});
