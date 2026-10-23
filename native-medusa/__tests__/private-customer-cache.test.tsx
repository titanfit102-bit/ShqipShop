import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import {
  clearPrivateCustomerQueries,
  privateCustomerQueryKey,
} from '../app/data/private-customer-queries';

jest.mock('../app/api/client', () => ({
  apiUrl: 'https://merchant-a.example.invalid',
}));

type Address = { address_1: string };

function AddressProbe({
  principal,
  load,
}: {
  principal: string;
  load: (principal: string) => Promise<Address[]>;
}) {
  const { data, isPending, isError } = useQuery({
    queryKey: privateCustomerQueryKey(principal, 'addresses'),
    queryFn: () => load(principal),
    retry: false,
  });
  const visible = data?.map(address => address.address_1).join(', ');
  return <>{visible || (isPending ? 'loading' : isError ? 'error' : 'empty')}</>;
}

const newClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });

let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
afterEach(async () => {
  if (renderer) {
    await ReactTestRenderer.act(async () => renderer?.unmount());
    renderer = undefined;
  }
});

test('private query keys are scoped to the backend and customer identity', () => {
  expect(privateCustomerQueryKey('cust_A', 'addresses')).not.toEqual(
    privateCustomerQueryKey('cust_B', 'addresses'),
  );
  expect(privateCustomerQueryKey('cust_A', 'orders')).not.toEqual(
    privateCustomerQueryKey('cust_A', 'addresses'),
  );
  expect(privateCustomerQueryKey('cust_A', 'order-detail', 'order_A')).not.toEqual(
    privateCustomerQueryKey('cust_A', 'order-detail', 'order_B'),
  );
});

test('logout clears scoped and legacy private data without clearing public catalog', async () => {
  const client = newClient();
  const addressKey = privateCustomerQueryKey('cust_A', 'addresses');
  client.setQueryData(addressKey, [{ address_1: 'A PRIVATE STREET' }]);
  client.setQueryData(['orders'], [{ id: 'order_A' }]);
  client.setQueryData(['order', 'order_A'], { id: 'order_A' });
  client.setQueryData(['address-list'], [{ address_1: 'LEGACY STREET' }]);
  client.setQueryData(['products'], [{ id: 'public-product' }]);

  await clearPrivateCustomerQueries(client);
  expect(client.getQueryData(addressKey)).toBeUndefined();
  expect(client.getQueryData(['orders'])).toBeUndefined();
  expect(client.getQueryData(['order', 'order_A'])).toBeUndefined();
  expect(client.getQueryData(['address-list'])).toBeUndefined();
  expect(client.getQueryData(['products'])).toEqual([
    { id: 'public-product' },
  ]);
});

test('A to B account switch never renders A address when B fetch fails', async () => {
  const client = newClient();
  // A has already visited the addresses screen: model the real cached-data risk.
  client.setQueryData(privateCustomerQueryKey('A', 'addresses'), [
    { address_1: 'A PRIVATE STREET' },
  ]);
  const load = jest.fn(async (principal: string): Promise<Address[]> => {
    if (principal === 'A') return [{ address_1: 'A PRIVATE STREET' }];
    throw new Error('B offline');
  });

  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <QueryClientProvider client={client}>
        <AddressProbe principal="A" load={load} />
      </QueryClientProvider>,
    );
  });
  expect(JSON.stringify(renderer?.toJSON())).toContain('A PRIVATE STREET');

  await ReactTestRenderer.act(async () => {
    renderer?.update(
      <QueryClientProvider client={client}>
        <AddressProbe principal="B" load={load} />
      </QueryClientProvider>,
    );
  });
  expect(JSON.stringify(renderer?.toJSON())).not.toContain('A PRIVATE STREET');
  await clearPrivateCustomerQueries(client);
  expect(JSON.stringify(renderer?.toJSON())).not.toContain('A PRIVATE STREET');
  expect(client.getQueryData(privateCustomerQueryKey('A', 'addresses'))).toBeUndefined();
});

test('A in-flight result cannot repopulate private cache after logout and B login', async () => {
  const client = newClient();
  let resolveA: ((value: Address[]) => void) | undefined;
  const pendingA = new Promise<Address[]>(resolve => { resolveA = resolve; });
  const load = (principal: string): Promise<Address[]> =>
    principal === 'A' ? pendingA : Promise.reject(new Error('B offline'));

  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <QueryClientProvider client={client}>
        <AddressProbe principal="A" load={load} />
      </QueryClientProvider>,
    );
  });
  await ReactTestRenderer.act(async () => {
    renderer?.update(
      <QueryClientProvider client={client}>
        <AddressProbe principal="B" load={load} />
      </QueryClientProvider>,
    );
    await clearPrivateCustomerQueries(client);
  });
  await ReactTestRenderer.act(async () => {
    resolveA?.([{ address_1: 'A LATE SECRET ADDRESS' }]);
    await Promise.resolve();
  });
  expect(JSON.stringify(renderer?.toJSON())).not.toContain('A LATE SECRET ADDRESS');
  expect(client.getQueryData(privateCustomerQueryKey('A', 'addresses'))).toBeUndefined();
});
