import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import apiClient from '../app/api/client';
import { CustomerProvider, useCustomer } from '../app/data/customer-context';
import { privateCustomerQueryKey } from '../app/data/private-customer-queries';

jest.mock('../app/api/client', () => ({
  __esModule: true,
  apiUrl: 'https://merchant-a.example.invalid',
  default: {
    auth: { login: jest.fn(), logout: jest.fn() },
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
  login.mockResolvedValue('disposable-token');
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
  login.mockResolvedValue('disposable-token');

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
