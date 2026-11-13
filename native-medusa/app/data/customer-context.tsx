import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { HttpTypes } from '@medusajs/types';
import apiClient from '@api/client';
import {
  blockAuthForLogin,
  clearNativeCustomerToken,
  confirmNewLoginToken,
  isCurrentAuthAttempt,
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

  const refreshCustomer = useCallback(async () => {
    const epoch = identityEpoch.current;
    try {
      const { customer: existingCustomer } =
        await apiClient.store.customer.retrieve();
      await applyCustomer(existingCustomer, epoch);
    } catch {
      // Failed or expired identity must not leave previous private data visible.
      await applyCustomer(undefined, epoch);
    }
  }, [applyCustomer]);

  useEffect(() => {
    // The identity generation rejects late responses from previous logins.
    refreshCustomer();
  }, [refreshCustomer]);

  const login = async (email: string, password: string) => {
    const epoch = ++identityEpoch.current;
    const authVersion = blockAuthForLogin();
    // Hide the previous account immediately. SDK login requests and their
    // custom-storage JWT writes must not overlap any logout or newer login.
    setCustomer(undefined);
    currentPrincipalId.current = undefined;
    const ensureCurrent = () => {
      if (epoch !== identityEpoch.current || !isCurrentAuthAttempt(authVersion)) {
        throw new Error('Customer login superseded by a newer session transition');
      }
    };

    return serializeNativeAuthOperation(async () => {
      ensureCurrent();
      await clearPrivateCustomerQueries(queryClient);
      ensureCurrent();
      const response = await apiClient.auth.login('customer', 'emailpass', {
        email,
        password,
      });
      // SDK may already have persisted a JWT when it resolves. Never
      // confirm/unblock or fetch private data for an invalidated attempt.
      ensureCurrent();
      if (typeof response === 'string') {
        await confirmNewLoginToken(response, authVersion);
        ensureCurrent();
        await Promise.all([refreshCustomer(), linkCartToCustomer()]);
        ensureCurrent();
      } else {
        // Third-party authentication is not completed here.
        console.log('Third party auth', response);
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
    try {
      const token = await apiClient.auth.register('customer', 'emailpass', {
        email,
        password,
      });

      await apiClient.client.setToken(token);

      await apiClient.store.customer.create({
        first_name: firstName,
        last_name: lastName,
        email,
      });
      // There's some bug with the token received from the register endpoint
      // so we need to login again
      await login(email, password);
    } catch (error) {
      throw error;
    }
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
