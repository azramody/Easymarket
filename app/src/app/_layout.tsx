import {
  PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold, useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { scheduleDaily } from '@/lib/notifications';
import { PlayerProvider } from '@/lib/player';
import { StoreProvider, useStore } from '@/lib/store';
import { colors, font } from '@/lib/theme';

SplashScreen.preventAutoHideAsync();

function Root() {
  const { ready } = useStore();
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold,
  });

  useEffect(() => {
    if (ready && fontsLoaded) SplashScreen.hideAsync();
  }, [ready, fontsLoaded]);

  useEffect(() => {
    scheduleDaily().catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(() => router.navigate('/'));
    return () => sub.remove();
  }, []);

  if (!ready || !fontsLoaded) return null;
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.bg },
        headerTitleStyle: { fontFamily: font.bold, color: colors.ink },
        headerTintColor: colors.ink,
        contentStyle: { backgroundColor: colors.bg },
      }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="topic/[id]" options={{ presentation: 'modal', title: '' }} />
      <Stack.Screen name="episode/[id]" options={{ title: '' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
    </Stack>
  );
}

export default function Layout() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <PlayerProvider>
          <StatusBar style="dark" />
          <Root />
        </PlayerProvider>
      </StoreProvider>
    </SafeAreaProvider>
  );
}
