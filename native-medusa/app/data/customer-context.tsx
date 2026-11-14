import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { HttpTypes } from '@medusajs/types';
import apiClient from '@api/client';
import {
  blockAuthForLogin,
  clearNativeCustomerToken,
  confirmNewLoginToken,
  isCurrentAuthAttempt,
  persistPendingAuthBarrier,
  serializeNativeAuthOperation,
} from '@api/auth-token-storage';
import { useCart } from './cart-context';
import { clearPrivateCustomerQueries } from './private-customer-queries';

type CustomerContextType = {
  customer?: HttpTypes.StoreCustomer;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
  ) => Promise<void>;
  refreshCustomer: () => Promise<void>;
  updateCustomer: (customer: HttpTypes.StoreUpdateCustomer) => Promise<void>;
};

const CustomerContext = createContext<CustomerContextType | null>(null);

type CustomerProviderProps = {
  children: React.ReactNode;
};

export const CustomerProvider = ({ children }: CustomerProviderProps) => {
  const [customer, setCustomer] = useState<HttpTypes.StoreCustomer>();
  const { linkCartToCustomer, resetCart } = useCart();
  const queryClient = useQueryClient();
  // Ignore responses from a previous login/logout generation.
  const identityEpoch = useRef(0);
  const currentPrincipalId = useRef<string | undefined>(undefined);

  const applyCustomer = useCallback(async (
    nextCustomer: HttpTypes.StoreCustomer | undefined,
    epoch: number,
  ) => {
    if (epoch !== identityEpoch.current) return;
    if (currentPrincipalId.current !== nextCustomer?.id) {
      currentPrincipalId.current = nextCustomer?.id;
      await clearPrivateCustomerQueries(queryClient);
    }
    if (epoch === identityEpoch.current) setCustomer(nextCustomer);
  }, [queryClient]);

  const refreshCustomerForEpoch = useCallback(async (epoch: number) => {
    try {
      const { customer: existingCustomer } =
        await apiClient.store.customer.retrieve();
      await applyCustomer(existingCustomer, epoch);
    } catch {
      // Failed or expired identity must not leave previous private data visible.
      await applyCustomer(undefined, epoch);
    }
  }, [applyCustomer]);

  const refreshCustomer = useCallback(
    () => refreshCustomerForEpoch(identityEpoch.current),
    [refreshCustomerForEpoch],
  );

  useEffect(() => {
    // The identity generation rejects late responses from previous logins.
    refreshCustomer();
  }, [refreshCustomer]);

  const ensureOwnedAuth = (epoch: number, authVersion: number) => {
    if (epoch !== identityEpoch.current || !isCurrentAuthAttempt(authVersion)) {
      throw new Error('Customer auth superseded by a newer session transition');
    }
  };

  // Reused by login and the final sign-in following a successful customer
  // creation. It runs INSIDE one serialized SDK operation; no nested queue.
  const finishOwnedLogin = async (
    email: string, password: string, epoch: number, authVersion: number,
  ) => {
    ensureOwnedAuth(epoch, authVersion);
    const response = await apiClient.auth.login('customer', 'emailpass', {
      email, password,
    });
    // Medusa SDK may persist a JWT before returning its login response.
    ensureOwnedAuth(epoch, authVersion);
    if (typeof response === 'string') {
      await confirmNewLoginToken(response, authVersion);
      ensureOwnedAuth(epoch, authVersion);
      await Promise.all([
        refreshCustomerForEpoch(epoch),
        linkCartToCustomer(),
      ]);
      ensureOwnedAuth(epoch, authVersion);
    } else {
      // SDK can persist an authentication JWT for MFA or verification-required
      // responses. None is a completed customer session in this app yet.
      // Reject without logging potentially sensitive SDK challenge payloads.
      if ('verification_required' in response && response.verification_required) {
        throw new Error('Customer login verification required before session activation');
      }
      if ('mfa_required' in response && response.mfa_required) {
        throw new Error('Customer login multi-factor authentication required');
      }
      throw new Error('Customer login requires additional authentication');
    }
  };

  const login = async (email: string, password: string) => {
    const epoch = ++identityEpoch.current;
    const authVersion = blockAuthForLogin();
    setCustomer(undefined);
    currentPrincipalId.current = undefined;

    return serializeNativeAuthOperation(async () => {
      ensureOwnedAuth(epoch, authVersion);
      try {
        await persistPendingAuthBarrier(authVersion);
        ensureOwnedAuth(epoch, authVersion);
        await clearPrivateCustomerQueries(queryClient);
        ensureOwnedAuth(epoch, authVersion);
        await finishOwnedLogin(email, password, epoch, authVersion);
      } catch (error) {
        // A failed/incomplete SDK login may already have written a JWT.
        // Its physical removal must finish before the next queued identity.
        if (epoch === identityEpoch.current && isCurrentAuthAttempt(authVersion)) {
          blockAuthForLogin();
        }
        let cleanupError: unknown;
        try {
          await clearNativeCustomerToken(apiClient.client);
        } catch (failure) {
          cleanupError = failure;
        }
        if (epoch === identityEpoch.current) {
          setCustomer(undefined);
          currentPrincipalId.current = undefined;
          await clearPrivateCustomerQueries(queryClient);
        }
        if (cleanupError) {
          throw new Error('Customer login could not clear its JWT', {
            cause: cleanupError,
          });
        }
        throw error;
      }
    });
  };

  const logout = async () => {
    const epoch = ++identityEpoch.current;
    // Block JWT access and wipe cart memory at logout INTENT, independently
    // of an older SDK login that may still be awaiting a remote response.
    blockAuthForLogin();
    setCustomer(undefined);
    currentPrincipalId.current = undefined;
    const cartReset = resetCart().then(
      () => ({ error: undefined as unknown }),
      (error: unknown) => ({ error }),
    );
    // Reserve this slot immediately, BEFORE the first await. A newer B login
    // queues behind both old A and its required physical token removal.
    const clearToken = serializeNativeAuthOperation(
      () => clearNativeCustomerToken(apiClient.client),
    );
    try {
      await clearPrivateCustomerQueries(queryClient);
      await clearToken;
    } finally {
      const cartResult = await cartReset;
      // A newer B may have started while cleanup was in flight: old logout
      // must not clear B's identity or private query cache afterward.
      if (epoch === identityEpoch.current) {
        await clearPrivateCustomerQueries(queryClient);
        setCustomer(undefined);
      }
      if (cartResult.error) throw cartResult.error;
    }
  };

  const register = async (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
  ) => {
    const epoch = ++identityEpoch.current;
    let authVersion = blockAuthForLogin();
    // A previous signed-in account must disappear at registration intent.
    setCustomer(undefined);
    currentPrincipalId.current = undefined;

    // auth.register and client.setToken can both write to SDK custom storage.
    // Reserve the same operation queue as login/logout before the first await.
    return serializeNativeAuthOperation(async () => {
      ensureOwnedAuth(epoch, authVersion);
      try {
        await persistPendingAuthBarrier(authVersion);
        ensureOwnedAuth(epoch, authVersion);
        await clearPrivateCustomerQueries(queryClient);
        ensureOwnedAuth(epoch, authVersion);

        const token = await apiClient.auth.register('customer', 'emailpass', {
          email, password,
        });
        ensureOwnedAuth(epoch, authVersion);
        await apiClient.client.setToken(token);
        ensureOwnedAuth(epoch, authVersion);

        // The registration JWT is NOT an existing signed-in customer session.
        // Verify its exact persisted value before allowing create() to use it.
        // This also clears a signed-out marker left by an earlier logout.
        await confirmNewLoginToken(token, authVersion);
        ensureOwnedAuth(epoch, authVersion);

        await apiClient.store.customer.create({
          first_name: firstName,
          last_name: lastName,
          email,
        });
        ensureOwnedAuth(epoch, authVersion);

        // After customer creation replace the registration JWT with a fresh
        // login JWT, without nesting a second serialized auth operation.
        authVersion = blockAuthForLogin();
        await persistPendingAuthBarrier(authVersion);
        ensureOwnedAuth(epoch, authVersion);
        await finishOwnedLogin(email, password, epoch, authVersion);
      } catch (error) {
        // Cleanup runs before the next queued B login/logout: an SDK-written
        // registration JWT must never be re-used after failed/stale creation.
        if (epoch === identityEpoch.current && isCurrentAuthAttempt(authVersion)) {
          blockAuthForLogin();
        }
        let cleanupError: unknown;
        try {
          await clearNativeCustomerToken(apiClient.client);
        } catch (failedCleanup) {
          cleanupError = failedCleanup;
        }
        if (epoch === identityEpoch.current) {
          setCustomer(undefined);
          currentPrincipalId.current = undefined;
          await clearPrivateCustomerQueries(queryClient);
        }
        if (cleanupError) {
          throw new Error('Customer registration could not clear its JWT', {
            cause: cleanupError,
          });
        }
        throw error;
      }
    });
  };

  const updateCustomer = async (data: HttpTypes.StoreUpdateCustomer) => {
    const epoch = identityEpoch.current;
    const response = await apiClient.store.customer.update(data);
    await applyCustomer(response.customer, epoch);
  };

  return (
    <CustomerContext.Provider
      value={{
        customer,
        login,
        logout,
        register,
        refreshCustomer,
        updateCustomer,
      }}
    >
      {children}
    </CustomerContext.Provider>
  );
};

export const useCustomer = () => {
  const context = useContext(CustomerContext);

  if (!context) {
    throw new Error('useCustomer must be used within a CustomerProvider');
  }

  return context;
};
