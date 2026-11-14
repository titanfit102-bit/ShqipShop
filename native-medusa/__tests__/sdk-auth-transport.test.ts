/**
 * @jest-environment node
 *
 * N02 transport boundary: the REAL locked @medusajs/js-sdk 2.21.2 issues
 * requests through a controlled fetch stub. No live server or secrets.
 */
import Medusa from '@medusajs/js-sdk';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AUTH_TOKEN_KEY,
  authTokenStorage,
  blockAuthForLogin,
  clearNativeCustomerToken,
  confirmNewLoginToken,
  persistPendingAuthBarrier,
  verifyPendingRegistrationToken,
} from '../app/api/auth-token-storage';

const mockDisk = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (key: string) => mockDisk.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      mockDisk.set(key, value);
    }),
    removeItem: jest.fn(async (key: string) => {
      mockDisk.delete(key);
    }),
  },
}));

type SeenRequest = { path: string; method: string; bearer: string | null };
const observed: SeenRequest[] = [];
const createSdk = () => new Medusa({
  baseUrl: 'https://medusa-transport.invalid',
  publishableKey: 'pk_synthetic_transport',
  auth: {
    type: 'jwt',
    jwtTokenStorageMethod: 'custom',
    jwtTokenStorageKey: AUTH_TOKEN_KEY,
    storage: authTokenStorage,
  },
});
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

let originalFetch: typeof fetch;
beforeAll(() => { originalFetch = globalThis.fetch; });
beforeEach(() => {
  mockDisk.clear();
  observed.length = 0;
  jest.clearAllMocks();
  blockAuthForLogin();
});
afterEach(() => { globalThis.fetch = originalFetch; });

test('N02 real SDK sends ONLY new registration bearer on customer.create and login bearer afterward', async () => {
  const sdk = createSdk();
  let version = blockAuthForLogin();
  // A bearer is physically persisted but must stay inaccessible after logout.
  mockDisk.set(AUTH_TOKEN_KEY, 'JWT_A_PRIVATE');
  mockDisk.set('shqipshop:jwt-signed-out', '1');

  globalThis.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    const headers = new Headers(init?.headers);
    observed.push({
      path,
      method: init?.method ?? 'GET',
      bearer: headers.get('authorization'),
    });
    if (path === '/auth/customer/emailpass/register') return json({ token: 'JWT_B_REGISTER' });
    if (path === '/store/customers') {
      if (headers.get('authorization') !== 'Bearer JWT_B_REGISTER') {
        return json({ message: 'Registration bearer missing or foreign' }, 401);
      }
      return json({ customer: { id: 'cust_B', email: 'b@example.invalid' } });
    }
    if (path === '/auth/customer/emailpass') return json({ token: 'JWT_B_LOGIN' });
    if (path === '/store/customers/me') return json({ customer: { id: 'cust_B' } });
    throw new Error('Unexpected real SDK route: ' + path);
  }) as typeof fetch;

  const registrationJwt = await sdk.auth.register('customer', 'emailpass', {
    email: 'b@example.invalid', password: 'synthetic',
  });
  expect(registrationJwt).toBe('JWT_B_REGISTER');
  // The locked SDK's auth.register calls setToken without awaiting it:
  // explicit awaited setToken and confirmNewLoginToken close that race.
  await sdk.client.setToken(registrationJwt);
  await verifyPendingRegistrationToken(registrationJwt, version);
  expect(await authTokenStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();

  const created = await sdk.store.customer.create(
    { email: 'b@example.invalid', first_name: 'B', last_name: 'Buyer' },
    undefined,
    { Authorization: `Bearer ${registrationJwt}` },
  );
  expect(created.customer.id).toBe('cust_B');
  expect(mockDisk.get(AUTH_TOKEN_KEY)).toBe('JWT_B_REGISTER');

  version = blockAuthForLogin();
  await persistPendingAuthBarrier(version);
  const loginJwt = await sdk.auth.login('customer', 'emailpass', {
    email: 'b@example.invalid', password: 'synthetic',
  });
  expect(loginJwt).toBe('JWT_B_LOGIN');
  if (typeof loginJwt !== 'string') {
    throw new Error('Unexpected verification or redirect response in synthetic login');
  }
  await confirmNewLoginToken(loginJwt, version);
  const profile = await sdk.store.customer.retrieve();
  expect(profile.customer.id).toBe('cust_B');
  expect(observed.map(x => x.path)).toEqual([
    '/auth/customer/emailpass/register',
    '/store/customers',
    '/auth/customer/emailpass',
    '/store/customers/me',
  ]);
  expect(observed[0].bearer).toBeNull();
  expect(observed[1].bearer).toBe('Bearer JWT_B_REGISTER');
  expect(observed[3].bearer).toBe('Bearer JWT_B_LOGIN');
  expect(observed.some(x => x.bearer?.includes('JWT_A_PRIVATE'))).toBe(false);
  expect(await authTokenStorage.getItem(AUTH_TOKEN_KEY)).toBe('JWT_B_LOGIN');
});

test('N02 real SDK cannot attach old A JWT after logout while disk removal is delayed', async () => {
  const sdk = createSdk();
  let version = blockAuthForLogin();
  await sdk.client.setToken('JWT_A_PRIVATE');
  await confirmNewLoginToken('JWT_A_PRIVATE', version);
  expect(await authTokenStorage.getItem(AUTH_TOKEN_KEY)).toBe('JWT_A_PRIVATE');

  let finishRemoval: (() => void) | undefined;
  (AsyncStorage.removeItem as jest.Mock).mockImplementation(async (key: string) => {
    if (key === AUTH_TOKEN_KEY) {
      await new Promise<void>(resolve => { finishRemoval = resolve; });
    }
    mockDisk.delete(key);
  });
  const logout = clearNativeCustomerToken(sdk.client);
  expect(await authTokenStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();

  globalThis.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    observed.push({
      path: new URL(String(input)).pathname,
      method: init?.method ?? 'GET',
      bearer: new Headers(init?.headers).get('authorization'),
    });
    return json({ message: 'Unauthenticated' }, 401);
  }) as typeof fetch;
  await expect(sdk.store.customer.retrieve()).rejects.toThrow('Unauthenticated');
  expect(observed).toEqual([{
    path: '/store/customers/me', method: 'GET', bearer: null,
  }]);
  // Resolve delayed physical deletion to avoid a hanging test.
  for (let i = 0; i < 15 && !finishRemoval; i++) await Promise.resolve();
  expect(finishRemoval).toBeDefined();
  finishRemoval?.();
  await logout;
  expect(await authTokenStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();
});
