import React from 'react';
import { Redirect } from 'expo-router';
import { useSettingsStore } from '../src/store/settingsStore';
import { LoadingState } from '../src/components/LoadingState';

/**
 * Initial route.
 *
 * Reads the persisted onboarding-completion flag and redirects:
 *  - If onboarding is not complete → /onboarding
 *  - If onboarding is complete     → /(tabs)
 *
 * While settings are hydrating from AsyncStorage, show a loading state.
 */
export default function Index() {
  const onboardingCompleted = useSettingsStore((s) => s.onboardingCompleted);
  const hydrated = useSettingsStore((s) => s.hydrated);

  if (!hydrated) {
    return <LoadingState message="Loading SmartPosture…" />;
  }

  if (!onboardingCompleted) {
    return <Redirect href="/onboarding" />;
  }

  return <Redirect href="/(tabs)" />;
}
