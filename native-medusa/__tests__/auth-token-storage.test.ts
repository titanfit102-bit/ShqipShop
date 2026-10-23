import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AUTH_TOKEN_KEY,
  authTokenStorage,
  blockAuthForLogin,
  clearNativeCustomerToken,
  confirmNewLoginToken,
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

const getItem = AsyncStorage.getItem as jest.Mock;
const removeItem = AsyncStorage.removeItem as jest.Mock;

const establishLogin = async (token: string) => {
  blockAuthForLogin();
  await authTokenStorage.setItem(AUTH_TOKEN_KEY, token);
  await confirmNewLoginToken(token);
  expect(await authTokenStorage.getItem(AUTH_TOKEN_KEY)).toBe(token);
};

beforeEach(() => {
  mockDisk.clear();
  jest.clearAllMocks();
  getItem.mockImplementation(async (key: string) => mockDisk.get(key) ?? null);
  removeItem.mockImplementation(async (key: string) => {
    mockDisk.delete(key);
  });
});

test('logout hides existing JWT before a delayed physical deletion completes', async () => {
  await establishLogin('old-A-jwt');
  let finishRemoval: (() => void) | undefined;
  const delayedRemove = new Promise<void>(resolve => {
    finishRemoval = resolve;
  });
  removeItem.mockImplementation(async (key: string) => {
    if (key === AUTH_TOKEN_KEY) {
      await delayedRemove;
    }
    mockDisk.delete(key);
  });

  let finished = false;
  const logout = clearNativeCustomerToken({
    clearToken: () => authTokenStorage.removeItem(AUTH_TOKEN_KEY),
  }).then(() => { finished = true; });

  expect(await authTokenStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();
  expect(finished).toBe(false);
  finishRemoval?.();
  await logout;
  expect(finished).toBe(true);
  expect(mockDisk.has(AUTH_TOKEN_KEY)).toBe(false);
  expect(await authTokenStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();
});

test('failed token removal reports error and never sends stale JWT', async () => {
  await establishLogin('old-A-jwt');
  removeItem.mockImplementation(async (key: string) => {
    if (key === AUTH_TOKEN_KEY) {
      throw new Error('simulated AsyncStorage write failure');
    }
    mockDisk.delete(key);
  });

  await expect(
    clearNativeCustomerToken({
      clearToken: () => authTokenStorage.removeItem(AUTH_TOKEN_KEY),
    }),
  ).rejects.toThrow('could not clear');
  expect(mockDisk.get(AUTH_TOKEN_KEY)).toBe('old-A-jwt');
  expect(await authTokenStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();

  removeItem.mockImplementation(async (key: string) => { mockDisk.delete(key); });
  await establishLogin('new-B-jwt');
  expect(mockDisk.get(AUTH_TOKEN_KEY)).toBe('new-B-jwt');
});

test('a token read started before logout cannot return the old JWT afterward', async () => {
  await establishLogin('old-A-jwt');
  let releaseRead: (() => void) | undefined;
  getItem.mockImplementation(async (key: string) => {
    if (key === AUTH_TOKEN_KEY) {
      await new Promise<void>(resolve => { releaseRead = resolve; });
    }
    return mockDisk.get(key) ?? null;
  });

  const pendingRead = authTokenStorage.getItem(AUTH_TOKEN_KEY);
  for (let index = 0; index < 10 && !releaseRead; index++) {
    await Promise.resolve();
  }
  expect(releaseRead).toBeDefined();

  // Start logout, then release the deliberately delayed read. Awaiting
  // logout first would also delay its verification read and deadlock the test.
  const logout = clearNativeCustomerToken({
    clearToken: () => authTokenStorage.removeItem(AUTH_TOKEN_KEY),
  });
  releaseRead?.();
  expect(await pendingRead).toBeNull();
  await logout;
});

test('new login remains blocked until verified storage write and marker removal', async () => {
  await establishLogin('old-A-jwt');
  await clearNativeCustomerToken({
    clearToken: () => authTokenStorage.removeItem(AUTH_TOKEN_KEY),
  });
  blockAuthForLogin();
  await authTokenStorage.setItem(AUTH_TOKEN_KEY, 'new-B-jwt');
  expect(await authTokenStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();
  await expect(confirmNewLoginToken('WRONG')).rejects.toThrow('could not be verified');
  expect(await authTokenStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();
  await confirmNewLoginToken('new-B-jwt');
  expect(await authTokenStorage.getItem(AUTH_TOKEN_KEY)).toBe('new-B-jwt');
});
