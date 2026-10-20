import React from 'react';
import { View, Text, ScrollView, StyleSheet, Image } from 'react-native';
import { Button } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useSettingsStore } from '../src/store/settingsStore';
import { useAppTheme } from '../src/theme/ThemeProvider';

export default function OnboardingScreen() {
  const router = useRouter();
  const { palette } = useAppTheme();
  const setOnboardingCompleted = useSettingsStore((s) => s.setOnboardingCompleted);

  const finish = async () => {
    await setOnboardingCompleted(true);
    router.replace('/(tabs)');
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: palette.background }]}
      contentContainerStyle={styles.content}
    >
      <View style={styles.hero}>
        <Text style={[styles.heroIcon, { color: palette.primary }]}>🧍‍♂️</Text>
        <Text style={[styles.title, { color: palette.text }]}>SmartPosture</Text>
        <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
          Your wearable companion for better sitting posture.
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>How it works</Text>
        <Text style={[styles.body, { color: palette.textSecondary }]}>
          Wear the SmartPosture sensor on your upper back. The sensor sends its
          measurements to the SmartPosture backend, and this app reads them from
          there. The phone never talks to the wearable directly.
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Wearing the sensor</Text>
        <Text style={[styles.body, { color: palette.textSecondary }]}>
          1. Attach the sensor to the upper back, centered along your spine.
          {'\n'}2. Make sure it sits flat and secure.
          {'\n'}3. Calibrate while sitting in your correct, neutral posture.
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border, borderLeftColor: palette.posture.warning, borderLeftWidth: 4 }]}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Not a medical device</Text>
        <Text style={[styles.body, { color: palette.textSecondary }]}>
          SmartPosture supports posture awareness and is not a medical diagnostic or
          treatment tool. It does not diagnose or treat any medical condition.
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Backend connection</Text>
        <Text style={[styles.body, { color: palette.textSecondary }]}>
          This app reads your posture data from the SmartPosture backend over your
          local network. Connect your phone to the same Wi-Fi network as the
          computer running the backend, and make sure the backend address is
          configured. The Device tab shows whether the backend and the wearable are
          reachable.
        </Text>
      </View>

      <View style={styles.actions}>
        <Button mode="contained" onPress={finish} style={[styles.button, { backgroundColor: palette.primary }]} labelStyle={{ color: palette.onPrimary }}>
          Get Started
        </Button>
        <Button mode="text" onPress={finish} textColor={palette.textMuted}>
          Skip
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, paddingBottom: 48 },
  hero: { alignItems: 'center', marginBottom: 24, marginTop: 24 },
  heroIcon: { fontSize: 56, marginBottom: 12 },
  title: { fontSize: 30, fontWeight: '800', marginBottom: 8 },
  subtitle: { fontSize: 15, textAlign: 'center', paddingHorizontal: 16 },
  card: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  body: { fontSize: 14, lineHeight: 21 },
  actions: { marginTop: 16, gap: 12 },
  button: { borderRadius: 12 },
});
