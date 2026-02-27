import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

// ── TYPES ──
export interface Dealer {
  dealer_id: string;
  name: string;
  city: string;
  state: string;
  zip: string;
  street: string;
  phone: string;
  website: string;
  latitude: number;
  longitude: number;
  inventory_count: number;
  dealer_type: string;
  franchise_dealer: boolean;
}

export interface DealershipVehicle {
  id: string;
  vin: string;
  year: number;
  make: string;
  model: string;
  trim: string;
  price: number;
  miles: number;
  exterior_color: string;
  interior_color: string;
  body_type: string;
  fuel_type: string;
  transmission: string;
  drivetrain: string;
  engine: string;
  inventory_type: string;
  dom_active: number;
  media: { photo_links: string[] };
  dealer: { id: string; name: string; city: string; state: string };
  heading: string;
  seller_type: string;
  is_certified: boolean;
  // Scoring fields
  score: number;
  tier: 'hot' | 'decent' | 'skip';
  rec: string;
  reason: string;
  price_diff: number;
  mile_diff: number;
  supply: string;
  market: {
    price: { mean: number; median: number; min: number; max: number };
    miles: { mean: number };
    total: number;
    competitors: Array<{
      price: number;
      miles: number;
      dealer: { name: string; city: string };
      dom_active: number;
    }>;
  } | null;
}

interface DealershipContextType {
  isConnected: boolean;
  dealer: Dealer | null;
  inventory: DealershipVehicle[];
  hotDeals: DealershipVehicle[];
  decentDeals: DealershipVehicle[];
  skipDeals: DealershipVehicle[];
  connectDealer: (dealer: Dealer, inventory: DealershipVehicle[]) => void;
  disconnect: () => void;
}

const STORAGE_KEY = 'dealerpost_dealership';

function loadFromStorage(): { dealer: Dealer | null; inventory: DealershipVehicle[] } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to load dealership from storage', e);
  }
  return { dealer: null, inventory: [] };
}

function saveToStorage(dealer: Dealer | null, inventory: DealershipVehicle[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ dealer, inventory }));
  } catch (e) {
    console.warn('Failed to save dealership to storage', e);
  }
}

const DealershipContext = createContext<DealershipContextType | null>(null);

export function DealershipProvider({ children }: { children: ReactNode }) {
  const saved = loadFromStorage();
  const [dealer, setDealer] = useState<Dealer | null>(saved.dealer);
  const [inventory, setInventory] = useState<DealershipVehicle[]>(saved.inventory);

  const connectDealer = useCallback((newDealer: Dealer, newInventory: DealershipVehicle[]) => {
    setDealer(newDealer);
    setInventory(newInventory);
    saveToStorage(newDealer, newInventory);
  }, []);

  const disconnect = useCallback(() => {
    setDealer(null);
    setInventory([]);
    saveToStorage(null, []);
  }, []);

  const hotDeals = inventory.filter(v => v.tier === 'hot');
  const decentDeals = inventory.filter(v => v.tier === 'decent');
  const skipDeals = inventory.filter(v => v.tier === 'skip');

  return (
    <DealershipContext.Provider
      value={{
        isConnected: dealer !== null,
        dealer,
        inventory,
        hotDeals,
        decentDeals,
        skipDeals,
        connectDealer,
        disconnect,
      }}
    >
      {children}
    </DealershipContext.Provider>
  );
}

export function useDealership() {
  const context = useContext(DealershipContext);
  if (!context) {
    throw new Error('useDealership must be used within a DealershipProvider');
  }
  return context;
}
