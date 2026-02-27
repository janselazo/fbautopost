import { createContext, useContext, useState, type ReactNode } from 'react';

export interface DealerInfo {
  name: string;
  address: string;
  phone: string;
  website: string;
  logoUrl: string | null;
}

interface DealerContextType {
  dealer: DealerInfo;
  setDealer: (info: DealerInfo) => void;
}

const defaultDealer: DealerInfo = {
  name: 'Premier Auto Group',
  address: '1234 Auto Blvd, Dallas, TX 75201',
  phone: '(214) 555-0198',
  website: 'https://premierautogroup.com',
  logoUrl: null,
};

const STORAGE_KEY = 'dealerpost_dealer_info';

function loadDealer(): DealerInfo {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaultDealer, ...JSON.parse(raw) };
  } catch (e) {
    console.warn('Failed to load dealer info from storage', e);
  }
  return defaultDealer;
}

const DealerContext = createContext<DealerContextType>({
  dealer: defaultDealer,
  setDealer: () => {},
});

export function DealerProvider({ children }: { children: ReactNode }) {
  const [dealer, setDealerState] = useState<DealerInfo>(loadDealer);

  function setDealer(info: DealerInfo) {
    setDealerState(info);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(info));
    } catch (e) {
      console.warn('Failed to save dealer info to storage', e);
    }
  }

  return (
    <DealerContext.Provider value={{ dealer, setDealer }}>
      {children}
    </DealerContext.Provider>
  );
}

export function useDealer() {
  return useContext(DealerContext);
}
