import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

// ── TYPES ──
export interface FacebookConnectionState {
  connected: boolean;
  accessToken: string | null;
  accountName: string | null;
  profilePicture: string | null;
  pageId: string | null;
  pageName: string | null;
}

interface FacebookContextType {
  // Connection state
  connected: boolean;
  accessToken: string | null;
  accountName: string | null;
  profilePicture: string | null;
  pageId: string | null;
  pageName: string | null;
  // Loading and error states
  isLoading: boolean;
  error: string | null;
  // Functions
  connect: () => Promise<void>;
  disconnect: () => void;
  refreshToken: () => Promise<void>;
}

const STORAGE_KEY = 'facebook_connection';

// Mock data for demo purposes
const MOCK_FACEBOOK_DATA: Omit<FacebookConnectionState, 'connected'> = {
  accessToken: 'mock_access_token_' + Math.random().toString(36).substring(7),
  accountName: 'John Dealer',
  profilePicture: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face',
  pageId: 'mock_page_123456',
  pageName: 'Premier Auto Group',
};

const defaultState: FacebookConnectionState = {
  connected: false,
  accessToken: null,
  accountName: null,
  profilePicture: null,
  pageId: null,
  pageName: null,
};

const FacebookContext = createContext<FacebookContextType | null>(null);

export function FacebookProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FacebookConnectionState>(defaultState);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load persisted state from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as FacebookConnectionState;
        setState(parsed);
      }
    } catch (err) {
      console.error('Failed to load Facebook connection state:', err);
    }
  }, []);

  // Persist state to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.error('Failed to save Facebook connection state:', err);
    }
  }, [state]);

  const connect = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Simulate OAuth flow delay
      await new Promise(resolve => setTimeout(resolve, 1500));

      // In a real implementation, this would:
      // 1. Open Facebook OAuth popup
      // 2. Handle the callback with authorization code
      // 3. Exchange code for access token via backend
      // 4. Fetch user profile and pages
      // For now, we use mock data

      setState({
        connected: true,
        ...MOCK_FACEBOOK_DATA,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect to Facebook';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setState(defaultState);
    setError(null);
  }, []);

  const refreshToken = useCallback(async () => {
    if (!state.connected) {
      setError('Not connected to Facebook');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Simulate token refresh delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // In a real implementation, this would call the backend to refresh the token
      // For now, we just generate a new mock token
      setState(prev => ({
        ...prev,
        accessToken: 'mock_access_token_' + Math.random().toString(36).substring(7),
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to refresh token';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [state.connected]);

  return (
    <FacebookContext.Provider
      value={{
        connected: state.connected,
        accessToken: state.accessToken,
        accountName: state.accountName,
        profilePicture: state.profilePicture,
        pageId: state.pageId,
        pageName: state.pageName,
        isLoading,
        error,
        connect,
        disconnect,
        refreshToken,
      }}
    >
      {children}
    </FacebookContext.Provider>
  );
}

export function useFacebook() {
  const context = useContext(FacebookContext);
  if (!context) {
    throw new Error('useFacebook must be used within a FacebookProvider');
  }
  return context;
}
