import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { HttpTypes } from '@medusajs/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '@api/client';
import { REGION_STORAGE_KEY, restoreSavedRegion } from './region-recovery';

type RegionContextType = {
  region?: HttpTypes.StoreRegion;
  setRegion: React.Dispatch<
    React.SetStateAction<HttpTypes.StoreRegion | undefined>
  >;
  regionLoading: boolean;
  regionError?: string;
  retryRegion: () => void;
};

const RegionContext = createContext<RegionContextType | null>(null);

type RegionProviderProps = {
  children: React.ReactNode;
};

export const RegionProvider = ({ children }: RegionProviderProps) => {
  const [region, setRegionState] = useState<HttpTypes.StoreRegion>();
  const [regionLoading, setRegionLoading] = useState(true);
  const [regionError, setRegionError] = useState<string>();
  const [retryCount, setRetryCount] = useState(0);
  const currentRegion = useRef<HttpTypes.StoreRegion | undefined>(undefined);
  // A user selection invalidates all earlier asynchronous restores.
  const epoch = useRef(0);
  // Serialize physical writes so an older selection cannot finish last.
  const persistence = useRef<Promise<void>>(Promise.resolve());

  const persistRegion = useCallback((id: string, version: number) => {
    const write = persistence.current
      .catch(() => undefined)
      .then(() => AsyncStorage.setItem(REGION_STORAGE_KEY, id));
    persistence.current = write;
    // Observe failures; never silently continue with an unhandled rejection.
    write.catch(error => {
      if (epoch.current === version) {
        setRegionError(
          error instanceof Error ? error.message : 'Could not save selected region',
        );
      }
    });
  }, []);

  const setRegion = useCallback<RegionContextType['setRegion']>(action => {
    const next = typeof action === 'function'
      ? action(currentRegion.current)
      : action;
    const version = ++epoch.current;
    currentRegion.current = next;
    setRegionState(next);
    setRegionError(undefined);
    setRegionLoading(false);
    if (next?.id) persistRegion(next.id, version);
  }, [persistRegion]);

  const retryRegion = useCallback(() => {
    const version = ++epoch.current;
    setRegionError(undefined);
    if (currentRegion.current?.id) {
      // Re-attempt a failed write without losing the selected region.
      persistRegion(currentRegion.current.id, version);
    } else {
      setRetryCount(count => count + 1);
    }
  }, [persistRegion]);

  useEffect(() => {
    if (currentRegion.current) return;
    let active = true;
    const version = ++epoch.current;
    setRegionLoading(true);
    setRegionError(undefined);

    (async () => {
      try {
        const result = await restoreSavedRegion(
          AsyncStorage,
          apiClient.store.region,
        );
        if (!active || epoch.current !== version) return;
        currentRegion.current = result.region;
        setRegionState(result.region);
        setRegionError(undefined);
        if (result.shouldPersist) persistRegion(result.region.id, version);
      } catch (error) {
        if (active && epoch.current === version) {
          setRegionError(
            error instanceof Error ? error.message : 'Region unavailable',
          );
        }
      } finally {
        if (active && epoch.current === version) setRegionLoading(false);
      }
    })();

    return () => { active = false; };
  }, [retryCount, persistRegion]);

  return (
    <RegionContext.Provider
      value={{ region, setRegion, regionLoading, regionError, retryRegion }}
    >
      {children}
    </RegionContext.Provider>
  );
};

export const useRegion = () => {
  const context = useContext(RegionContext);
  if (!context) throw new Error('useRegion must be used within a RegionProvider');
  return context;
};

export const useCountries = () => {
  const { region } = useRegion();
  return region?.countries;
};
