import React from 'react';
import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../../src/theme/ThemeProvider';

/**
 * Tab navigation: Home, Live, History, Device, Settings.
 *
 * Analytics, Sessions, Events and AI recommendations are pushed on top of the
 * tab navigator from the dashboard (see `app/analytics.tsx` and friends).
 */
export default function TabsLayout() {
  const { palette } = useAppTheme();

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: true,
        headerStyle: { backgroundColor: palette.surface },
        headerTintColor: palette.text,
        headerTitleStyle: { color: palette.text, fontWeight: '600' },
        contentStyle: { backgroundColor: palette.background },
        tabBarStyle: {
          backgroundColor: palette.surface,
          borderTopColor: palette.border,
        },
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.textMuted,
        tabBarIcon: ({ color, size, focused }) => {
          const iconMap: Record<string, React.ComponentProps<typeof MaterialCommunityIcons>['name']> = {
            index: focused ? 'home' : 'home-outline',
            live: focused ? 'chart-line' : 'chart-line-variant',
            history: focused ? 'history' : 'clock-outline',
            device: focused ? 'server-network' : 'server-network-off',
            settings: focused ? 'cog' : 'cog-outline',
          };
          const name = iconMap[route.name] ?? 'help-circle';
          return <MaterialCommunityIcons name={name} size={size} color={color} />;
        },
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="live" options={{ title: 'Live' }} />
      <Tabs.Screen name="history" options={{ title: 'History' }} />
      <Tabs.Screen name="device" options={{ title: 'Device' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
