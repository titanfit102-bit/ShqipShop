import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../app/api/client';
import { AUTH_TOKEN_KEY, authTokenStorage, blockAuthForLogin } from '../app/api/auth-token-storage';
import { CartProvider, useCart } from '../app/data/cart-context';
import { CustomerProvider, useCustomer } from '../app/data/customer-context';

const mockDisk = new Map<string, string>();
let mockRegion: { id: string } | undefined;
let mockCartRemovalBroken = false;

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (key: string) => mockDisk.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => { mockDisk.set(key, value); }),
    removeItem: jest.fn(async (key: string) => {
      if (key === 'cart_id' && mockCartRemovalBroken) {
        throw new Error('synthetic cart disk removal failure');
      }
      mockDisk.delete(key);
    }),
  },
}));
jest.mock('../app/data/region-context', () => ({
  useRegion: () => ({ region: mockRegion }),
}));
jest.mock('../app/api/client', () => ({
  __esModule: true,
  apiUrl: 'https://merchant-a.example.invalid',
  default: {
    auth: { login: jest.fn() },
    client: { clearToken: jest.fn() },
    store: {
      customer: { retrieve: jest.fn() },
      cart: {
        retrieve: jest.fn(), create: jest.fn(), update: jest.fn(),
        transferCart: jest.fn(),
      },
    },
  },
}));

let cartActions: ReturnType<typeof useCart> | undefined;
let customerActions: ReturnType<typeof useCustomer> | undefined;
let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
function Probe() {
  cartActions = useCart();
  customerActions = useCustomer();
  return <>{customerActions.customer?.id ?? 'guest'}</>;
}
const mount = () => (
  <CartProvider>
    <QueryClientProvider client={new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })}>
      <CustomerProvider><Probe /></CustomerProvider>
    </QueryClientProvider>
  </CartProvider>
);

beforeEach(() => {
  jest.clearAllMocks();
  mockDisk.clear();
  mockRegion = undefined;
  mockCartRemovalBroken = false;
  // jest.clearAllMocks clears call counts, not mockImplementation; restore
  // baseline storage behavior after the prior test's delayed-token override.
  (AsyncStorage.getItem as jest.Mock).mockImplementation(
    async (key: string) => mockDisk.get(key) ?? null,
  );
  (AsyncStorage.setItem as jest.Mock).mockImplementation(
    async (key: string, value: string) => { mockDisk.set(key, value); },
  );
  (AsyncStorage.removeItem as jest.Mock).mockImplementation(async (key: string) => {
    if (key === 'cart_id' && mockCartRemovalBroken) {
      throw new Error('synthetic cart disk removal failure');
    }
    mockDisk.delete(key);
  });
  cartActions = undefined;
  customerActions = undefined;
  blockAuthForLogin();

  (apiClient.auth.login as jest.Mock).mockImplementation(
    async (_role: string, _method: string, input: { email: string }) => {
      const token = input.email.startsWith('a@') ? 'synthetic-A-jwt' : 'synthetic-B-jwt';
      await authTokenStorage.setItem(AUTH_TOKEN_KEY, token);
      return token;
    },
  );
  (apiClient.client.clearToken as jest.Mock).mockImplementation(
    () => authTokenStorage.removeItem(AUTH_TOKEN_KEY),
  );
  (apiClient.store.customer.retrieve as jest.Mock).mockImplementation(async () => {
    const token = await authTokenStorage.getItem(AUTH_TOKEN_KEY);
    return { customer: token ? { id: token === 'synthetic-A-jwt' ? 'cust_A' : 'cust_B' } : undefined };
  });
  (apiClient.store.cart.transferCart as jest.Mock).mockImplementation(
    async (id: string) => ({ cart: {
      id, region_id: 'reg_al',
      email: (await authTokenStorage.getItem(AUTH_TOKEN_KEY)) === 'synthetic-B-jwt'
        ? 'b@example.invalid'
        : 'a@example.invalid',
    } }),
  );
  (apiClient.store.cart.create as jest.Mock).mockResolvedValue({
    cart: { id: 'cart_new_guest', region_id: 'reg_al' },
  });
});
afterEach(async () => {
  if (renderer) await ReactTestRenderer.act(async () => renderer?.unmount());
  renderer = undefined;
});

test('N01 integrated real providers: late A cart response cannot cross logout and B login', async () => {
  await ReactTestRenderer.act(async () => { renderer = ReactTestRenderer.create(mount()); });
  await ReactTestRenderer.act(async () => {
    cartActions!.setCart({ id: 'cart_A', region_id: 'reg_al' } as never);
  });
  await ReactTestRenderer.act(async () => {
    await customerActions!.login('a@example.invalid', 'synthetic');
  });
  expect(customerActions?.customer?.id).toBe('cust_A');
  expect(cartActions?.cart?.email).toBe('a@example.invalid');

  let releaseOld!: (value: { cart: never }) => void;
  (apiClient.store.cart.update as jest.Mock).mockImplementationOnce(
    () => new Promise(resolve => { releaseOld = resolve; }),
  );
  let oldUpdate!: Promise<unknown>;
  await ReactTestRenderer.act(async () => {
    oldUpdate = cartActions!.updateCart({ email: 'a-secret@example.invalid' });
    await Promise.resolve();
  });

  let finishTokenRemoval: (() => void) | undefined;
  (AsyncStorage.removeItem as jest.Mock).mockImplementation(async (key: string) => {
    if (key === AUTH_TOKEN_KEY) {
      await new Promise<void>(resolve => { finishTokenRemoval = resolve; });
    }
    mockDisk.delete(key);
  });
  let logoutPending!: Promise<void>;
  await ReactTestRenderer.act(async () => {
    logoutPending = customerActions!.logout();
    await Promise.resolve();
  });

  expect(customerActions?.customer).toBeUndefined();
  expect(cartActions?.cart).toBeUndefined();
  expect(await authTokenStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();

  await ReactTestRenderer.act(async () => {
    cartActions!.setCart({ id: 'cart_guest', region_id: 'reg_al' } as never);
    releaseOld({ cart: {
      id: 'cart_A', region_id: 'reg_al',
      email: 'a-secret@example.invalid',
      shipping_address: { address_1: 'SYNTHETIC A PRIVATE ADDRESS' },
    } as never });
    await oldUpdate;
  });
  expect(cartActions?.cart?.id).toBe('cart_guest');
  expect(cartActions?.cart?.email).toBeUndefined();

  // A token deletion must finish before B can legitimately establish a token.
  finishTokenRemoval?.();
  await ReactTestRenderer.act(async () => { await logoutPending; });
  await ReactTestRenderer.act(async () => {
    await customerActions!.login('b@example.invalid', 'synthetic');
  });

  expect(customerActions?.customer?.id).toBe('cust_B');
  expect(cartActions?.cart?.id).toBe('cart_guest');
  expect(cartActions?.cart?.email).toBe('b@example.invalid');
  expect(await authTokenStorage.getItem(AUTH_TOKEN_KEY)).toBe('synthetic-B-jwt');
  expect(JSON.stringify(renderer?.toJSON())).not.toContain('SYNTHETIC A PRIVATE ADDRESS');
});

test('N01 combined provider reboot: marker blocks A restore, then repaired storage creates guest cart', async () => {
  mockDisk.set('cart_id', 'cart_PRIVATE_A');
  await ReactTestRenderer.act(async () => { renderer = ReactTestRenderer.create(mount()); });
  await ReactTestRenderer.act(async () => {
    cartActions!.setCart({
      id: 'cart_PRIVATE_A', region_id: 'reg_al', email: 'a-secret@example.invalid',
    } as never);
  });

  mockCartRemovalBroken = true;
  await ReactTestRenderer.act(async () => {
    await expect(cartActions!.resetCart()).rejects.toThrow('synthetic cart disk removal failure');
  });
  expect(cartActions?.cart).toBeUndefined();
  expect(mockDisk.get('shqipshop:cart-reset-pending')).toBe('1');
  expect(mockDisk.get('cart_id')).toBe('cart_PRIVATE_A');

  await ReactTestRenderer.act(async () => { renderer?.unmount(); });
  renderer = undefined;
  mockRegion = { id: 'reg_al' };
  await ReactTestRenderer.act(async () => { renderer = ReactTestRenderer.create(mount()); });

  expect(cartActions?.cart).toBeUndefined();
  expect(cartActions?.cartError).toMatch(/synthetic cart disk removal failure/);
  expect(apiClient.store.cart.retrieve).not.toHaveBeenCalled();

  mockCartRemovalBroken = false;
  await ReactTestRenderer.act(async () => { cartActions!.retryCart(); });
  expect(cartActions?.cart?.id).toBe('cart_new_guest');
  expect(cartActions?.cart?.email).toBeUndefined();
  expect(mockDisk.get('cart_id')).toBe('cart_new_guest');
  expect(mockDisk.has('shqipshop:cart-reset-pending')).toBe(false);
  expect(apiClient.store.cart.retrieve).not.toHaveBeenCalled();
});
