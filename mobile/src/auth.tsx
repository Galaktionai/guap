import { useQueryClient } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import { api, setOnSessionExpired, setSessionToken, type User } from './api';

const TOKEN_KEY = 'guap.session';

// The token goes to the iOS Keychain / Android Keystore. SecureStore does not
// exist on the web build (used only for development), so it falls back to
// localStorage there.
const tokenStorage = {
  get: () => (Platform.OS === 'web' ? Promise.resolve(localStorage.getItem(TOKEN_KEY)) : SecureStore.getItemAsync(TOKEN_KEY)),
  set: (token: string) =>
    Platform.OS === 'web' ? Promise.resolve(localStorage.setItem(TOKEN_KEY, token)) : SecureStore.setItemAsync(TOKEN_KEY, token),
  clear: () =>
    Platform.OS === 'web' ? Promise.resolve(localStorage.removeItem(TOKEN_KEY)) : SecureStore.deleteItemAsync(TOKEN_KEY),
};

type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; user: User | null };

type AuthContextValue = {
  state: AuthState;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  // Forget the session locally: token, cached data of this user.
  const dropSession = useCallback(async () => {
    setSessionToken(null);
    await tokenStorage.clear();
    queryClient.clear();
    setState({ status: 'signedOut' });
  }, [queryClient]);

  // Restore the session saved on the device.
  useEffect(() => {
    let cancelled = false;
    tokenStorage
      .get()
      .then(async (token) => {
        if (cancelled) return;
        if (!token) return setState({ status: 'signedOut' });
        setSessionToken(token);
        setState({ status: 'signedIn', user: null });
        // Fill in the email; a rejected token signs out via onSessionExpired.
        const user = await api.me().catch(() => null);
        if (!cancelled && user) setState({ status: 'signedIn', user });
      })
      .catch(() => !cancelled && setState({ status: 'signedOut' }));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setOnSessionExpired(() => void dropSession());
    return () => setOnSessionExpired(null);
  }, [dropSession]);

  const start = useCallback(
    async ({ token, user }: { token: string; user: User }) => {
      queryClient.clear(); // never show the previous user's cached data
      setSessionToken(token);
      await tokenStorage.set(token);
      setState({ status: 'signedIn', user });
    },
    [queryClient],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      signIn: async (email, password) => start(await api.login(email, password)),
      signUp: async (email, password) => start(await api.register(email, password)),
      signOut: async () => {
        // End the session on the server too; sign out locally even if offline.
        await api.logout().catch(() => undefined);
        await dropSession();
      },
    }),
    [state, start, dropSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
