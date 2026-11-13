import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import apiClient from '../app/api/client';
import { authTokenStorage, AUTH_TOKEN_KEY } from '../app/api/auth-token-storage';
import { CustomerProvider, useCustomer } from '../app/data/customer-context';
import { privateCustomerQueryKey } from '../app/data/private-customer-queries';

const mockJwtStorage = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (key: string) => mockJwtStorage.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => { mockJwtStorage.set(key, value); }),
    removeItem: jest.fn(async (key: string) => { mockJwtStorage.delete(key); }),
  },
}));

jest.mock('../app/api/client', () => ({
  __esModule: true,
  apiUrl: 'https://merchant-a.example.invalid',
  default: {
    auth: { login: jest.fn(), logout: jest.fn() },
    client: { clearToken: jest.fn() },
    store: { customer: { retrieve: jest.fn() } },
  },
}));
const mockLinkCartToCustomer = jest.fn(async () => undefined);
const mockResetCart = jest.fn(async () => undefined);
jest.mock('../app/data/cart-context', () => ({
  useCart: () => ({
    linkCartToCustomer: mockLinkCartToCustomer,
    resetCart: mockResetCart,
  }),
}));

const retrieve = apiClient.store.customer.retrieve as jest.Mock;
const login = apiClient.auth.login as jest.Mock;
const logout = apiClient.auth.logout as jest.Mock;
const clearToken = apiClient.client.clearToken as jest.Mock;

let actions: ReturnType<typeof useCustomer> | undefined;
let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
function IdentityReader() {
  actions = useCustomer();
  return <>{actions.customer?.id ?? 'signed-out'}</>;
}
function mount(client: QueryClient) {
  return (
    <QueryClientProvider client={client}>
      <CustomerProvider>
        <IdentityReader />
      </CustomerProvider>
    </QueryClientProvider>
  );
}
beforeEach(() => {
  retrieve.mockReset();
  login.mockReset();
  logout.mockReset();
  clearToken.mockReset();
  mockJwtStorage.clear();
  clearToken.mockImplementation(() => authTokenStorage.removeItem(AUTH_TOKEN_KEY));
  mockLinkCartToCustomer.mockClear();
  mockResetCart.mockClear();
  actions = undefined;
});
afterEach(async () => {
  if (renderer) {
    await ReactTestRenderer.act(async () => renderer?.unmount());
    renderer = undefined;
  }
});

test('real CustomerProvider clears cached PII before B login', async () => {
  const client = new QueryClient();
  let identity = 'cust_A';
  retrieve.mockImplementation(async () => ({ customer: { id: identity } }));
  login.mockImplementation(async () => {
    await authTokenStorage.setItem(AUTH_TOKEN_KEY, 'disposable-token');
    return 'disposable-token';
  });
  logout.mockResolvedValue(undefined);

  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(mount(client));
  });
  expect(actions?.customer?.id).toBe('cust_A');

  const oldKey = privateCustomerQueryKey('cust_A', 'addresses');
  client.setQueryData(oldKey, [{ address_1: 'A SECRET STREET' }]);
  await ReactTestRenderer.act(async () => {
    await actions?.logout();
  });
  expect(actions?.customer).toBeUndefined();
  expect(client.getQueryData(oldKey)).toBeUndefined();
  expect(mockResetCart).toHaveBeenCalledTimes(1);

  identity = 'cust_B';
  await ReactTestRenderer.act(async () => {
    await actions?.login('b@example.invalid', 'synthetic');
  });
  expect(actions?.customer?.id).toBe('cust_B');
  expect(client.getQueryData(oldKey)).toBeUndefined();
  expect(mockLinkCartToCustomer).toHaveBeenCalledTimes(1);
});

test('old account refresh response cannot replace a newer identity', async () => {
  const client = new QueryClient();
  let resolveOld: ((value: unknown) => void) | undefined;
  retrieve
    .mockImplementationOnce(
      () => new Promise(resolve => { resolveOld = resolve; }),
    )
    .mockResolvedValueOnce({ customer: { id: 'cust_B' } });
  login.mockImplementation(async () => {
    await authTokenStorage.setItem(AUTH_TOKEN_KEY, 'disposable-token');
    return 'disposable-token';
  });

  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(mount(client));
  });
  expect(actions?.customer).toBeUndefined();

  await ReactTestRenderer.act(async () => {
    await actions?.login('b@example.invalid', 'synthetic');
  });
  expect(actions?.customer?.id).toBe('cust_B');

  await ReactTestRenderer.act(async () => {
    resolveOld?.({ customer: { id: 'cust_A' } });
    await Promise.resolve();
  });
  expect(actions?.customer?.id).toBe('cust_B');
});

test('N01 logout starts cart reset before asynchronous token removal', async () => {
  const client = new QueryClient();
  retrieve.mockResolvedValue({ customer: { id: 'cust_A' } });
  let releaseTokenRemoval: (() => void) | undefined;
  clearToken.mockImplementationOnce(
    () => new Promise<void>(resolve => { releaseTokenRemoval = resolve; }),
  );
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(mount(client));
  });
  let logoutPending!: Promise<void>;
  await ReactTestRenderer.act(async () => {
    logoutPending = actions!.logout();
    await Promise.resolve();
  });
  // The cart must be invalidated as soon as logout is requested, not after
  // cancelQueries/token removal, which may remain pending.
  expect(mockResetCart).toHaveBeenCalledTimes(1);
  // Let the underlying promise finish even if the assertion above regresses.
  releaseTokenRemoval?.();
  await ReactTestRenderer.act(async () => { await logoutPending; });
});

test('N04 late A SDK login cannot reactivate JWT after logout', async () => {
  const client = new QueryClient();
  retrieve.mockImplementation(async () => {
    const token = await authTokenStorage.getItem(AUTH_TOKEN_KEY);
    return { customer: token === 'jwt_A' ? { id: 'cust_A' } : undefined };
  });
  let releaseA!: () => void;
  login.mockImplementation(async () => {
    await new Promise<void>(resolve => { releaseA = resolve; });
    // Mimic the SDK's custom storage write before returning its JWT.
    await authTokenStorage.setItem(AUTH_TOKEN_KEY, 'jwt_A');
    return 'jwt_A';
  });
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(mount(client));
  });
  let pendingA!: Promise<void>;
  await ReactTestRenderer.act(async () => {
    pendingA = actions!.login('a@example.invalid', 'synthetic');
    for (let i = 0; i < 10 && !releaseA; i++) await Promise.resolve();
  });
  expect(releaseA).toBeDefined();
  let pendingLogout!: Promise<void>;
  await ReactTestRenderer.act(async () => {
    pendingLogout = actions!.logout();
    await Promise.resolve();
  });
  expect(actions?.customer).toBeUndefined();
  expect(await authTokenStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();
  // Logout reserves an exclusive token clear after A's in-flight SDK write.
  await ReactTestRenderer.act(async () => {
    releaseA();
    await expect(pendingA).rejects.toThrow(/superseded/i);
    await pendingLogout;
  });
  expect(actions?.customer).toBeUndefined();
  expect(await authTokenStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();
  expect(mockLinkCartToCustomer).not.toHaveBeenCalled();
});

test('N04 late A SDK token cannot replace B after logout and newer login', async () => {
  const client = new QueryClient();
  retrieve.mockImplementation(async () => {
    const token = await authTokenStorage.getItem(AUTH_TOKEN_KEY);
    return { customer: token === 'jwt_B' ? { id: 'cust_B' } :
      token === 'jwt_A' ? { id: 'cust_A' } : undefined };
  });
  let releaseA!: () => void;
  login.mockImplementation(async (_role: string, _method: string, data: { email: string }) => {
    if (data.email.startsWith('a@')) {
      await new Promise<void>(resolve => { releaseA = resolve; });
      await authTokenStorage.setItem(AUTH_TOKEN_KEY, 'jwt_A');
      return 'jwt_A';
    }
    await authTokenStorage.setItem(AUTH_TOKEN_KEY, 'jwt_B');
    return 'jwt_B';
  });
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(mount(client));
  });
  let pendingA!: Promise<void>;
  await ReactTestRenderer.act(async () => {
    pendingA = actions!.login('a@example.invalid', 'synthetic');
    for (let i = 0; i < 10 && !releaseA; i++) await Promise.resolve();
  });
  expect(releaseA).toBeDefined();
  let pendingLogout!: Promise<void>;
  await ReactTestRenderer.act(async () => {
    pendingLogout = actions!.logout();
    await Promise.resolve();
  });
  expect(actions?.customer).toBeUndefined();

  let pendingB!: Promise<void>;
  await ReactTestRenderer.act(async () => {
    pendingB = actions!.login('b@example.invalid', 'synthetic');
    await Promise.resolve();
  });
  await ReactTestRenderer.act(async () => {
    releaseA();
    await expect(pendingA).rejects.toThrow(/superseded/i);
    await pendingLogout;
    await pendingB;
  });
  expect(actions?.customer?.id).toBe('cust_B');
  expect(await authTokenStorage.getItem(AUTH_TOKEN_KEY)).toBe('jwt_B');
  expect(mockJwtStorage.get(AUTH_TOKEN_KEY)).toBe('jwt_B');
  expect(mockLinkCartToCustomer).toHaveBeenCalledTimes(1);
});
