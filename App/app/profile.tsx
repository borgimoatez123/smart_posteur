import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import Constants from 'expo-constants';
import { useAppTheme } from '../src/theme/ThemeProvider';
import { useDeviceStatus } from '../src/hooks/useDeviceStatus';
import { useBackendHealth } from '../src/hooks/useBackendHealth';
import { StatusPill } from '../src/components/StatusPill';
import { DEVICE_STATUS_LABEL, DEVICE_STATUS_TONE } from '../src/utils/postureDisplay';
import { DEVICE_ID, API_BASE_URL, USES_CUSTOM_BACKEND_URL } from '../src/config/appConfig';
import { formatBatteryLevel, formatDateTime, formatRelative } from '../src/utils/format';

/**
 * Profile / about screen.
 *
 * Device information is read from the backend, which is the only component that
 * knows whether the wearable is online. The app never infers the wearable's
 * state from the phone's own connectivity.
 */
export default function ProfileScreen() {
  const { palette } = useAppTheme();
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';
  const health = useBackendHealth();
  const status = useDeviceStatus();
  const device = status.data;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: palette.background }]}
      contentContainerStyle={styles.content}
    >
      <View style={[styles.header, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <View style={[styles.avatar, { backgroundColor: palette.primary }]}>
          <Text style={styles.avatarText}>SP</Text>
        </View>
        <Text style={[styles.name, { color: palette.text }]}>SmartPosture</Text>
        <Text style={[styles.sub, { color: palette.textSecondary }]}>
          Posture awareness companion
        </Text>
      </View>

      <Section title="Wearable" palette={palette}>
        {device === null ? (
          <Text style={[styles.aboutBody, { color: palette.textSecondary }]}>
            {status.loading
              ? 'Reading the wearable state from the backend…'
              : status.error
                ? `The wearable state could not be read: ${status.error.message}`
                : 'No wearable state available.'}
          </Text>
        ) : (
          <>
            <View style={styles.statusRow}>
              <Text style={[styles.infoLabel, { color: palette.textSecondary }]}>Status</Text>
              <StatusPill
                label={DEVICE_STATUS_LABEL[device.status]}
                tone={DEVICE_STATUS_TONE[device.status]}
              />
            </View>
            <InfoRow label="Name" value={device.name ?? '—'} palette={palette} />
            <InfoRow label="Device ID" value={DEVICE_ID} palette={palette} />
            <InfoRow
              label="Last contact"
              value={device.lastSeen === null ? '—' : formatRelative(device.lastSeen)}
              palette={palette}
            />
            <InfoRow
              label="Last contact (exact)"
              value={formatDateTime(device.lastSeen)}
              palette={palette}
            />
            <InfoRow
              label="Battery"
              value={formatBatteryLevel(device.batteryLevel)}
              palette={palette}
            />
          </>
        )}
      </Section>

      <Section title="Backend" palette={palette}>
        <InfoRow label="Address" value={API_BASE_URL} palette={palette} />
        <InfoRow
          label="Address source"
          value={USES_CUSTOM_BACKEND_URL ? 'EXPO_PUBLIC_API_URL' : 'Built-in default'}
          palette={palette}
        />
        <InfoRow
          label="Server"
          value={health.data === null ? '—' : health.data.status === 'ok' ? 'Online' : 'Degraded'}
          palette={palette}
        />
        <InfoRow
          label="MongoDB"
          value={health.data === null ? '—' : health.data.database}
          palette={palette}
        />
      </Section>

      <Section title="About" palette={palette}>
        <InfoRow label="App Version" value={appVersion} palette={palette} />
        <Text style={[styles.aboutBody, { color: palette.textSecondary }]}>
          SmartPosture is a wearable posture monitoring system. An ESP32-based
          wearable with an MPU6050 sensor sends measurements and heartbeats to the
          SmartPosture backend. This app reads the stored data from that backend
          over your local network; it does not contact the wearable directly.
        </Text>
      </Section>

      <Section title="Data" palette={palette}>
        <Text style={[styles.aboutBody, { color: palette.textSecondary }]}>
          Measurements, sessions, events and AI recommendations are stored by the
          SmartPosture backend. This app keeps only your local preferences (theme,
          units, display options) on the device, and displays the backend data as it
          is stored — it never generates substitute values.
        </Text>
      </Section>

      <Section title="Disclaimer" palette={palette}>
        <View style={[styles.disclaimer, { borderLeftColor: palette.posture.warning }]}>
          <Text style={[styles.disclaimerText, { color: palette.textSecondary }]}>
            SmartPosture supports posture awareness and is not a medical device.
            It does not diagnose, treat, or prevent any medical condition. Always
            consult a qualified healthcare professional for medical advice. AI
            recommendations are general ergonomic suggestions, not medical advice.
          </Text>
        </View>
      </Section>
    </ScrollView>
  );
}

function Section({ title, children, palette }: { title: string; children: React.ReactNode; palette: any }) {
  return (
    <View style={[styles.section, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <Text style={[styles.sectionTitle, { color: palette.textMuted }]}>{title.toUpperCase()}</Text>
      {children}
    </View>
  );
}

function InfoRow({ label, value, palette }: { label: string; value: string; palette: any }) {
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, { color: palette.textSecondary }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: palette.text }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  header: { alignItems: 'center', padding: 24, borderRadius: 16, borderWidth: 1 },
  avatar: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: '800' },
  name: { fontSize: 20, fontWeight: '700' },
  sub: { fontSize: 13, marginTop: 2 },
  section: { borderRadius: 16, borderWidth: 1, padding: 16 },
  sectionTitle: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, marginBottom: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  infoLabel: { fontSize: 14 },
  infoValue: { fontSize: 14, fontWeight: '600', maxWidth: '60%', textAlign: 'right' },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  aboutBody: { fontSize: 13, lineHeight: 20 },
  disclaimer: { borderLeftWidth: 4, paddingLeft: 12 },
  disclaimerText: { fontSize: 13, lineHeight: 20 },
});
