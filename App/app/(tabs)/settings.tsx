import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Switch, SegmentedButtons } from 'react-native-paper';
import { useSettingsStore } from '../../src/store/settingsStore';
import { useAppTheme } from '../../src/theme/ThemeProvider';
import { PERSISTENCE_DELAY_PRESETS, type ThemeMode, type MeasurementUnit } from '../../src/types/settings';
import { API_BASE_URL, DEVICE_ID } from '../../src/config/appConfig';

/**
 * Settings screen.
 *
 * Only genuinely local preferences live here. Measurements, sessions, events
 * and AI recommendations are stored by the backend, and the wearable's own
 * behaviour (vibration, alert thresholds) is owned by its firmware — this app
 * cannot change it.
 */
export default function SettingsScreen() {
  const { palette } = useAppTheme();
  const settings = useSettingsStore();

  return (
    <ScrollView style={[styles.container, { backgroundColor: palette.background }]} contentContainerStyle={styles.content}>
      <Section title="Appearance">
        <Row label="Theme">
          <SegmentedButtons
            value={settings.theme}
            onValueChange={(v) => settings.setTheme(v as ThemeMode)}
            buttons={[
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </Row>
        <Row label="Units">
          <SegmentedButtons
            value={settings.unit}
            onValueChange={(v) => settings.setUnit(v as MeasurementUnit)}
            buttons={[
              { value: 'degrees', label: '°' },
              { value: 'radians', label: 'rad' },
            ]}
          />
        </Row>
      </Section>

      <Section title="Alerts">
        <Row label="Vibration alerts">
          <Switch
            value={settings.alerts.vibrationEnabled}
            onValueChange={(v) => settings.setAlertSetting('vibrationEnabled', v)}
            color={palette.primary}
          />
        </Row>
        <Row label="Poor-posture delay">
          <SegmentedButtons
            value={String(settings.alerts.persistenceDelay)}
            onValueChange={(v) => settings.setAlertSetting('persistenceDelay', Number(v))}
            buttons={PERSISTENCE_DELAY_PRESETS.map((d) => ({ value: String(d), label: `${d}s` }))}
          />
        </Row>
        <Row label="Notifications">
          <Switch
            value={settings.alerts.notificationsEnabled}
            onValueChange={(v) => settings.setAlertSetting('notificationsEnabled', v)}
            color={palette.primary}
          />
        </Row>
        <Row label="Daily reminder">
          <Switch
            value={settings.alerts.dailyReminderEnabled}
            onValueChange={(v) => settings.setAlertSetting('dailyReminderEnabled', v)}
            color={palette.primary}
          />
        </Row>
        <Text style={[styles.hint, { color: palette.textMuted }]}>
          These are display preferences for this app. The vibration motor and the
          alert thresholds themselves are controlled by the wearable's own
          firmware; this app does not contact the wearable to change them.
        </Text>
      </Section>

      <Section title="Backend">
        <Text style={[styles.body, { color: palette.textSecondary }]}>
          This app reads posture data from the SmartPosture backend. The backend
          address is configured through the EXPO_PUBLIC_API_URL environment
          variable (or the built-in default).
        </Text>
        <Text style={[styles.mono, { color: palette.text }]}>{API_BASE_URL}</Text>
        <Text style={[styles.mono, { color: palette.textMuted }]}>device: {DEVICE_ID}</Text>
      </Section>

      <Section title="Data">
        <Text style={[styles.body, { color: palette.textSecondary }]}>
          Measurements, sessions, events and AI recommendations are stored by the
          SmartPosture backend, not on this phone. The app has no local posture
          history to clear; to delete stored data, do so on the backend. This app
          only keeps your local preferences on the device.
        </Text>
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { palette } = useAppTheme();
  return (
    <View style={[styles.section, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <Text style={[styles.sectionTitle, { color: palette.textMuted }]}>{title.toUpperCase()}</Text>
      {children}
    </View>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  const { palette } = useAppTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: palette.text }]}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  section: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 4 },
  sectionTitle: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, marginBottom: 8 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  rowLabel: { fontSize: 15, flex: 1, marginRight: 12 },
  hint: { fontSize: 12, marginTop: 8, lineHeight: 16 },
  body: { fontSize: 13, lineHeight: 20 },
  mono: { fontSize: 12, marginTop: 8, fontWeight: '600' },
});
