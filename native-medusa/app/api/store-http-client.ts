import type Medusa from '@medusajs/js-sdk';
import {AUTH_TOKEN_KEY, authTokenStorage, getNativeAuthVersion} from './auth-token-storage';

type SdkStore = Medusa['store'];
type StoreApi = {
  region: Pick<SdkStore['region'], 'list' | 'retrieve'>;
  collection: Pick<SdkStore['collection'], 'list' | 'retrieve'>;
  category: Pick<SdkStore['category'], 'list' | 'retrieve'>;
  product: Pick<SdkStore['product'], 'list' | 'retrieve'>;
  cart: Pick<SdkStore['cart'], 'create' | 'retrieve' | 'update' | 'createLineItem' | 'updateLineItem' |
    'deleteLineItem' | 'addShippingMethod' | 'transferCart' | 'complete'>;
  customer: Pick<SdkStore['customer'], 'create' | 'retrieve' | 'update' | 'listAddress' |
    'createAddress' | 'updateAddress' | 'deleteAddress'>;
  fulfillment: Pick<SdkStore['fulfillment'], 'listCartOptions' | 'calculate'>;
  payment: Pick<SdkStore['payment'], 'listPaymentProviders' | 'initiatePaymentSession'>;
  order: Pick<SdkStore['order'], 'list' | 'retrieve'>;
};

type Options = {
  method?: 'GET' | 'POST' | 'DELETE';
  query?: object;
  headers?: object;
  body?: unknown;
};

function encodedQuery(input?: object) {
  const pairs: string[] = [];
  function visit(key: string, value: unknown) {
    if (value === undefined || value === null) return;
    if (typeof value === 'object') {
      for (const [name, item] of Object.entries(value)) visit(`${key}[${name}]`, item);
      return;
    }
    pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  for (const [key, value] of Object.entries(input ?? {})) visit(key, value);
  return pairs.join('&');
}

const id = encodeURIComponent;

export function createStoreHttpClient(baseUrl: string, publishableKey: string) {
  const setToken = (token: string) => authTokenStorage.setItem(AUTH_TOKEN_KEY, token);
  const clearToken = () => authTokenStorage.removeItem(AUTH_TOKEN_KEY);

  async function request<T>(path: string, options: Options = {}): Promise<T> {
    const route = path.split('?')[0];
    const authRoute = /^\/auth\/customer\/emailpass(?:\/register)?$/.test(route);
    if ((!authRoute && !route.startsWith('/store/')) ||
        /[\\#]|(?:^|\/)(?:(?:\.|%2e){1,2})(?:\/|$)/i.test(route)) {
      throw new Error('Unsupported Medusa Store API route');
    }
    const authVersion = getNativeAuthVersion();
    const bearer = authRoute ? null : await authTokenStorage.getItem(AUTH_TOKEN_KEY);
    if (getNativeAuthVersion() !== authVersion) throw new Error('Customer session changed');
    const headers = new Headers({
      Accept: 'application/json', 'content-type': 'application/json',
    });
    if (publishableKey) headers.set('x-publishable-api-key', publishableKey);
    if (bearer) headers.set('authorization', `Bearer ${bearer}`);
    for (const [key, value] of Object.entries(options.headers ?? {})) {
      if (value === null) headers.delete(key);
      else if (value !== undefined) headers.set(key, String(value));
    }
    const query = encodedQuery(options.query);
    const url = baseUrl.replace(/\/$/, '') + path + (query ? (path.includes('?') ? '&' : '?') + query : '');
    const init: RequestInit & {redirect: "error"} = {
      method: options.method ?? 'GET', headers, credentials: 'omit', redirect: 'error',
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    };
    const response = await fetch(url, init);
    const data = await response.json().catch(() => undefined);
    if (!response.ok) {
      throw Object.assign(new Error(typeof data?.message === 'string' ? data.message :
        `Medusa request failed (${response.status})`), {status: response.status});
    }
    if (response.status !== 204 && data === undefined) throw new Error('Invalid Medusa JSON response');
    return data;
  }

  const get = <T>(path: string, query?: object, headers?: object) =>
    request<T>(path, {query, headers});
  const post = <T>(path: string, body?: unknown, query?: object, headers?: object) =>
    request<T>(path, {method: 'POST', body, query, headers});
  const remove = <T>(path: string, query?: object, headers?: object) =>
    request<T>(path, {method: 'DELETE', query, headers});

  const cart = (cartId: string) => `/store/carts/${id(cartId)}`;
  const line = (cartId: string, lineId: string) => `${cart(cartId)}/line-items/${id(lineId)}`;
  const customer = '/store/customers/me';
  const address = (addressId: string) => `${customer}/addresses/${id(addressId)}`;
  const store: StoreApi = {
    region: {
      list: (query, headers) => get('/store/regions', query, headers),
      retrieve: (regionId, query, headers) => get(`/store/regions/${id(regionId)}`, query, headers),
    },
    collection: {
      list: (query, headers) => get('/store/collections', query, headers),
      retrieve: (collectionId, query, headers) => get(`/store/collections/${id(collectionId)}`, query, headers),
    },
    category: {
      list: (query, headers) => get('/store/product-categories', query, headers),
      retrieve: (categoryId, query, headers) => get(`/store/product-categories/${id(categoryId)}`, query, headers),
    },
    product: {
      list: (query, headers) => get('/store/products', query, headers),
      retrieve: (productId, query, headers) => get(`/store/products/${id(productId)}`, query, headers),
    },
    cart: {
      create: (body, query, headers) => post('/store/carts', body, query, headers),
      retrieve: (cartId, query, headers) => get(cart(cartId), query, headers),
      update: (cartId, body, query, headers) => post(cart(cartId), body, query, headers),
      createLineItem: (cartId, body, query, headers) => post(`${cart(cartId)}/line-items`, body, query, headers),
      updateLineItem: (cartId, key, body, query, headers) => post(line(cartId, key), body, query, headers),
      deleteLineItem: (cartId, key, query, headers) => remove(line(cartId, key), query, headers),
      addShippingMethod: (cartId, body, query, headers) => post(`${cart(cartId)}/shipping-methods`, body, query, headers),
      transferCart: (cartId, query, headers) => post(`${cart(cartId)}/customer`, undefined, query, headers),
      complete: (cartId, query, headers) => post(`${cart(cartId)}/complete`, undefined, query, headers),
    },
    customer: {
      create: (body, query, headers) => post('/store/customers', body, query, headers),
      retrieve: (query, headers) => get(customer, query, headers),
      update: (body, query, headers) => post(customer, body, query, headers),
      listAddress: (query, headers) => get(`${customer}/addresses`, query, headers),
      createAddress: (body, query, headers) => post(`${customer}/addresses`, body, query, headers),
      updateAddress: (addressId, body, query, headers) => post(address(addressId), body, query, headers),
      deleteAddress: (addressId, headers) => remove(address(addressId), undefined, headers),
    },
    fulfillment: {
      listCartOptions: (query, headers) => get('/store/shipping-options', query, headers),
      calculate: (optionId, body, query, headers) => post(`/store/shipping-options/${id(optionId)}/calculate`, body, query, headers),
    },
    payment: {
      listPaymentProviders: (query, headers) => get('/store/payment-providers', query, headers),
      async initiatePaymentSession(cartToPay, body, query, headers) {
        const authVersion = getNativeAuthVersion();
        const collection = cartToPay.payment_collection?.id ??
          (await post<{payment_collection: {id: string}}>('/store/payment-collections',
            {cart_id: cartToPay.id}, undefined, headers)).payment_collection.id;
        if (getNativeAuthVersion() !== authVersion) throw new Error('Customer session changed');
        return post(`/store/payment-collections/${id(collection)}/payment-sessions`, body, query, headers);
      },
    },
    order: {
      list: (query, headers) => get('/store/orders', query, headers),
      retrieve: (orderId, query, headers) => get(`/store/orders/${id(orderId)}`, query, headers),
    },
  };

  const tokenResponse = async (path: string, body: {email: string; password: string}) =>
    post<{token?: string; location?: string; verification_required?: boolean;
      verification?: unknown; mfa_challenge?: unknown}>(path, body);
  const auth = {
    logout: clearToken,
    async register(_actor: 'customer', _strategy: 'emailpass', body: {email: string; password: string}) {
      const {token} = await tokenResponse('/auth/customer/emailpass/register', body);
      if (!token) throw new Error('Unexpected authentication response');
      return token;
    },
    async login(_actor: 'customer', _strategy: 'emailpass', body: {email: string; password: string}) {
      const authVersion = getNativeAuthVersion();
      const result = await tokenResponse('/auth/customer/emailpass', body);
      if (getNativeAuthVersion() !== authVersion) throw new Error('Customer session changed');
      if (result.location) return {location: result.location};
      if (!result.token) throw new Error('Unexpected authentication response');
      if (result.verification_required) return {verification_required: true};
      if (result.mfa_challenge) return {mfa_required: true};
      await setToken(result.token);
      return result.token;
    },
  };

  return {store, auth, client: {fetch: request, setToken, clearToken}};
}
