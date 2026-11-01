import AsyncStorage from '@react-native-async-storage/async-storage';

export const AUTH_TOKEN_KEY = 'auth_token';
const SIGNED_OUT_MARKER_KEY = 'shqipshop:jwt-signed-out';

// A synchronous in-memory barrier prevents old bearer tokens from being
// reused while AsyncStorage removal is delayed or has failed.
let tokenAccessBlocked = false;
let pendingWrites: Promise<void> = Promise.resolve();

const queueWrite = (work: () => Promise<void>): Promise<void> => {
  const operation = pendingWrites.catch(() => undefined).then(work);
  pendingWrites = operation;
  return operation;
};

/**
 * The Medusa SDK reads the JWT through its custom storage for EACH request.
 * Never return a token when a logout transition or persisted logout marker
 * is present, including if an asynchronous read finishes after logout starts.
 */
export const authTokenStorage = {
  async getItem(key: string): Promise<string | null> {
    if (tokenAccessBlocked) return null;
    try {
      await pendingWrites;
      if (tokenAccessBlocked) return null;
      const marker = await AsyncStorage.getItem(SIGNED_OUT_MARKER_KEY);
      if (marker !== null || tokenAccessBlocked) return null;
      const token = await AsyncStorage.getItem(key);
      return tokenAccessBlocked ? null : token;
    } catch {
      // Storage errors are never a reason to send stale credentials.
      return null;
    }
  },
  setItem(key: string, value: string): Promise<void> {
    return queueWrite(() => AsyncStorage.setItem(key, value));
  },
  removeItem(key: string): Promise<void> {
    return queueWrite(() => AsyncStorage.removeItem(key));
  },
};

export const blockAuthForLogin = () => {
  tokenAccessBlocked = true;
};

/** A new login only becomes usable after its own JWT was persisted. */
export const confirmNewLoginToken = async (expectedToken: string) => {
  await pendingWrites;
  const storedToken = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  if (!expectedToken || storedToken !== expectedToken) {
    throw new Error('New customer session could not be verified in storage');
  }
  await AsyncStorage.removeItem(SIGNED_OUT_MARKER_KEY);
  tokenAccessBlocked = false;
};

/**
 * SDK auth.logout() doesn't await Client.clearToken() with custom storage.
 * Calling the awaited client method directly avoids this SDK race for JWT auth.
 * A persisted marker prevents a stale token being sent after app restart if
 * its physical removal fails. Failure stays visible to the caller.
 */
export const clearNativeCustomerToken = async (
  client: { clearToken(): Promise<void> },
) => {
  tokenAccessBlocked = true;
  let markerError: unknown;
  try {
    await AsyncStorage.setItem(SIGNED_OUT_MARKER_KEY, '1');
  } catch (error) {
    markerError = error;
  }

  let clearError: unknown;
  try {
    await client.clearToken();
  } catch (error) {
    clearError = error;
  }

  let storedToken: string | null = null;
  try {
    storedToken = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  } catch (error) {
    throw new Error('Customer logout could not verify token removal', {
      cause: error,
    });
  }

  if (clearError || storedToken !== null) {
    throw new Error('Customer logout could not clear the stored token', {
      cause: clearError,
    });
  }

  // If marking logout failed but token deletion succeeded, no old JWT remains.
  // A failed marker can be repaired on the next successful login.
  if (markerError) return;
};
