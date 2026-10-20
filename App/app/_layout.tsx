import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useAppTheme } from '../src/theme/ThemeProvider';
import { useSettingsStore } from '../src/store/settingsStore';

function RootLayoutNav() {
  const { palette, isDark } = useAppTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: palette.surface },
        headerTintColor: palette.text,
        headerTitleStyle: { color: palette.text },
        contentStyle: { backgroundColor: palette.background },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="analytics" options={{ headerShown: true, title: 'Analytics' }} />
      <Stack.Screen name="sessions" options={{ headerShown: true, title: 'Sessions' }} />
      <Stack.Screen name="events" options={{ headerShown: true, title: 'Events' }} />
      <Stack.Screen name="ai" options={{ headerShown: true, title: 'AI recommendations' }} />
      <Stack.Screen name="telemetry/[id]" options={{ headerShown: true, title: 'Measurement' }} />
      <Stack.Screen name="calibration" options={{ presentation: 'modal', headerShown: true, title: 'Calibration' }} />
      <Stack.Screen name="profile" options={{ headerShown: true, title: 'Profile' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const hydrate = useSettingsStore((s) => s.hydrate);

  // The app talks to the SmartPosture backend over HTTP only: there is no
  // Bluetooth stack to initialise here.
  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <RootLayoutNav />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
