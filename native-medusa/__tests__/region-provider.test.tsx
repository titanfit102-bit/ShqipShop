import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import type { HttpTypes } from '@medusajs/types';
import apiClient from '../app/api/client';
import { RegionProvider, useRegion } from '../app/data/region-context';

const mockDisk = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (key: string) => mockDisk.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => { mockDisk.set(key, value); }),
    removeItem: jest.fn(async (key: string) => { mockDisk.delete(key); }),
  },
}));
jest.mock('../app/api/client', () => ({
  __esModule: true,
  default: {
    store: { region: { retrieve: jest.fn(), list: jest.fn() } },
  },
}));
import AsyncStorage from '@react-native-async-storage/async-storage';

const stored = AsyncStorage.getItem as jest.Mock;
const write = AsyncStorage.setItem as jest.Mock;
const retrieve = apiClient.store.region.retrieve as jest.Mock;
const list = apiClient.store.region.list as jest.Mock;
const mkRegion = (id: string) => ({ id, name: id } as HttpTypes.StoreRegion);
let context: ReturnType<typeof useRegion> | undefined;
let renderer: ReactTestRenderer.ReactTestRenderer | undefined;

function Probe() {
  context = useRegion();
  return <>{context.region?.id ?? (context.regionLoading ? 'loading' : 'region-error')}</>;
}

beforeEach(() => {
  mockDisk.clear();
  context = undefined;
  jest.clearAllMocks();
  stored.mockImplementation(async (key: string) => mockDisk.get(key) ?? null);
  write.mockImplementation(async (key: string, value: string) => { mockDisk.set(key, value); });
  retrieve.mockImplementation(async (id: string) => ({ region: mkRegion(id) }));
  list.mockResolvedValue({ regions: [mkRegion('reg_default')] });
});
afterEach(async () => {
  if (renderer) {
    await ReactTestRenderer.act(async () => renderer?.unmount());
    renderer = undefined;
  }
});

const mount = async () => {
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<RegionProvider><Probe /></RegionProvider>);
  });
};

test('offline initial lookup shows error and retries without deleting saved region', async () => {
  mockDisk.set('region_id', 'reg_saved');
  retrieve.mockRejectedValueOnce(new Error('offline'));
  await mount();
  expect(context?.region).toBeUndefined();
  expect(context?.regionError).toBe('offline');
  expect(mockDisk.get('region_id')).toBe('reg_saved');

  await ReactTestRenderer.act(async () => context?.retryRegion());
  expect(context?.region?.id).toBe('reg_saved');
  expect(context?.regionError).toBeUndefined();
  expect(mockDisk.get('region_id')).toBe('reg_saved');
});

test('outdated boot response cannot overwrite the user-selected region', async () => {
  mockDisk.set('region_id', 'reg_old');
  let releaseOld: ((result: { region: HttpTypes.StoreRegion }) => void) | undefined;
  retrieve.mockImplementationOnce(() => new Promise(resolve => { releaseOld = resolve; }));
  // Do not await a deliberately pending boot request.
  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<RegionProvider><Probe /></RegionProvider>);
  });

  await ReactTestRenderer.act(async () => {
    context?.setRegion(mkRegion('reg_new'));
  });
  await ReactTestRenderer.act(async () => {
    releaseOld?.({ region: mkRegion('reg_old') });
    await Promise.resolve();
  });
  expect(context?.region?.id).toBe('reg_new');
  expect(mockDisk.get('region_id')).toBe('reg_new');
});

test('rapid B then C selections persist in order, not the order writes finish', async () => {
  await mount();
  let finishB: (() => void) | undefined;
  const delayed = new Promise<void>(resolve => { finishB = resolve; });
  write.mockImplementation(async (key: string, value: string) => {
    if (value === 'reg_B') await delayed;
    mockDisk.set(key, value);
  });
  await ReactTestRenderer.act(async () => {
    context?.setRegion(mkRegion('reg_B'));
    context?.setRegion(mkRegion('reg_C'));
  });
  expect(context?.region?.id).toBe('reg_C');
  finishB?.();
  await ReactTestRenderer.act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(mockDisk.get('region_id')).toBe('reg_C');
});

test('failed selected-region persistence reports error and supports retry', async () => {
  await mount();
  write.mockRejectedValueOnce(new Error('disk write failed'));
  await ReactTestRenderer.act(async () => {
    context?.setRegion(mkRegion('reg_B'));
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(context?.region?.id).toBe('reg_B');
  expect(context?.regionError).toBe('disk write failed');
  await ReactTestRenderer.act(async () => {
    context?.retryRegion();
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(mockDisk.get('region_id')).toBe('reg_B');
  expect(context?.regionError).toBeUndefined();
});
