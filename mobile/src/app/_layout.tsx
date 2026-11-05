import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthProvider, useAuth } from '@/auth';
import { LoadingView } from '@/components/ui';
import { colors } from '@/theme';

const sheet = { presentation: 'modal', contentStyle: { backgroundColor: colors.surface } } as const;

function RootStack() {
  const { state } = useAuth();
  // Wait until the saved session is read, so the sign-in screen does not flash.
  if (state.status === 'loading') return <LoadingView />;
  const signedIn = state.status === 'signedIn';

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bgBase } }}>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="asset/[id]" />
        <Stack.Screen name="stats" />
        <Stack.Screen name="categories" />
        <Stack.Screen name="account" />
        <Stack.Screen name="new-transaction" options={sheet} />
        <Stack.Screen name="new-asset" options={sheet} />
        <Stack.Screen name="category-edit" options={sheet} />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="sign-up" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 10_000 } } }),
  );

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bgBase }}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <StatusBar style="dark" />
          <RootStack />
        </AuthProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
