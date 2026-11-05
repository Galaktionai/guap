import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { colors } from '@/theme';

export default function RootLayout() {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 10_000 } } }),
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bgBase } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="asset/[id]" />
          <Stack.Screen name="stats" />
          <Stack.Screen name="new-transaction" options={{ presentation: 'modal', contentStyle: { backgroundColor: colors.surface } }} />
          <Stack.Screen name="new-asset" options={{ presentation: 'modal', contentStyle: { backgroundColor: colors.surface } }} />
        </Stack>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
