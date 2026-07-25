// Root layout: providers + auth-gated navigation. Waits for the persisted
// session to rehydrate from secure storage, then routes to /login when there
// is no token, or into the app when there is.
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { queryClient } from '@/lib/query/queryClient';
import { useAuthStore } from '@/lib/auth/store';

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="auto" />
        <AuthGate />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

function AuthGate() {
  const token = useAuthStore((s) => s.token);
  const hydrated = useAuthStore((s) => s.hydrated);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!hydrated) return;
    const onLoginScreen = segments[0] === 'login';
    if (!token && !onLoginScreen) {
      router.replace('/login');
    } else if (token && onLoginScreen) {
      router.replace('/');
    }
  }, [token, hydrated, segments, router]);

  // Block rendering the routes until the secure-store session is restored,
  // so we don't flash the login screen for an already-signed-in user.
  if (!hydrated) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
