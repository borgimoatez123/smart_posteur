import React, { useCallback } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from 'react-native-paper';
import { useAppTheme } from '../../src/theme/ThemeProvider';
import { useBackendHealth } from '../../src/hooks/useBackendHealth';
import { useDeviceStatus } from '../../src/hooks/useDeviceStatus';
import { useResource } from '../../src/hooks/useResource';
import { listDevices } from '../../src/api/deviceApi';
import { BackendStatusBar } from '../../src/components/BackendStatusBar';
import { ErrorState } from '../../src/components/ErrorState';
import { LoadingState } from '../../src/components/LoadingState';
import { EmptyState } from '../../src/components/EmptyState';
import { PostureBadge } from '../../src/components/PostureBadge';
import { StatusPill } from '../../src/components/StatusPill';
import { SectionCard, InfoRow } from '../../src/components/InfoCard';
import { DEVICE_STATUS_LABEL, DEVICE_STATUS_TONE, parsePostureLabel } from '../../src/utils/postureDisplay';
import {
  formatBatteryLevel,
  formatDateTime,
  formatDegrees,
  formatPercent,
  formatRelative,
  formatSecondsAgo,
} from '../../src/utils/format';
import {
  API_BASE_URL,
  DEVICE_ID,
  HEALTH_POLL_INTERVAL_MS,
  LIVE_POLL_INTERVAL_MS,
  STATUS_POLL_INTERVAL_MS,
  SUMMARY_POLL_INTERVAL_MS,
  USES_CUSTOM_BACKEND_URL,
} from '../../src/config/appConfig';

/**
 * Screen H — Device & system status.
 *
 * The wearable's online/offline state comes from the server (heartbeat and
 * telemetry age). The phone never reports the device as online just because it
 * can reach the backend, and it never sends heartbeats on the device's behalf.
 */
export default function SystemScreen() {
  const { palette } = useAppTheme();

  const health = useBackendHealth();
  const status = useDeviceStatus();
  const devices = useResource((signal) => listDevices(signal), { pollMs: STATUS_POLL_INTERVAL_MS });

  const reloadAll = useCallback(async () => {
    await Promise.all([health.reload(), status.reload(), devices.reload()]);
  }, [health, status, devices]);

  const refresh = useCallback(() => {
    void reloadAll();
  }, [reloadAll]);

  const refreshing = (health.refreshing || status.refreshing) && health.data !== null;

  const deviceUnknown = status.error?.code === 'DEVICE_NOT_FOUND';
  const statusData = status.data;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: palette.background }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={reloadAll}
          tintColor={palette.primary}
          colors={[palette.primary]}
        />
      }
    >
      <BackendStatusBar
        health={health.data}
        error={health.error}
        lastUpdatedAt={health.lastUpdatedAt}
        onRetry={health.reload}
      />

      {health.data !== null && (
        <SectionCard title="Backend">
          <InfoRow
            label="Status"
            value={
              health.data.status === 'ok' && health.data.database === 'connected'
                ? 'Reachable and healthy'
                : 'Reachable but degraded'
            }
            tone={
              health.data.status === 'ok' && health.data.database === 'connected' ? 'good' : 'warning'
            }
          />
          <InfoRow label="API base URL" value={API_BASE_URL} />
          <InfoRow
            label="Address source"
            value={USES_CUSTOM_BACKEND_URL ? 'EXPO_PUBLIC_API_URL' : 'Built-in default'}
          />
          <InfoRow label="MongoDB" value={health.data.database} />
          <InfoRow
            label="Server time"
            value={formatDateTime(health.data.timestamp)}
            hint="Used to judge how old the last device contact is."
          />
          {health.data.databaseError !== undefined && (
            <Text style={[styles.note, { color: palette.error }]}>
              Database error: {health.data.databaseError}
            </Text>
          )}
        </SectionCard>
      )}

      {/* ---------------- Wearable ---------------- */}
      {status.loading && statusData === null && !deviceUnknown ? (
        <LoadingState message="Loading device status…" />
      ) : deviceUnknown ? (
        <EmptyState
          icon="🔌"
          title="Wearable not registered"
          message={`The backend has never received a heartbeat or measurement from "${DEVICE_ID}". Power on the wearable and make sure it can reach the server.`}
        />
      ) : statusData === null ? (
        status.error ? (
          <ErrorState error={status.error} onRetry={status.reload} compact />
        ) : null
      ) : (
        <SectionCard title="Wearable">
          <View style={styles.statusHeader}>
            <StatusPill
              label={DEVICE_STATUS_LABEL[statusData.status]}
              tone={DEVICE_STATUS_TONE[statusData.status]}
            />
            <Text style={[styles.deviceId, { color: palette.textMuted }]}>{statusData.deviceId}</Text>
          </View>

          <InfoRow label="Name" value={statusData.name ?? '—'} />
          <InfoRow
            label="Last contact"
            value={formatRelative(statusData.lastSeen)}
            hint={statusData.lastSeen ?? 'The device has never contacted the backend.'}
          />
          <InfoRow
            label="Silence for"
            value={formatSecondsAgo(statusData.secondsSinceLastSeen)}
            hint={`Offline after ${statusData.offlineTimeoutSeconds}s without a heartbeat.`}
          />
          <InfoRow label="Battery" value={formatBatteryLevel(statusData.batteryLevel)} />
          <InfoRow
            label="Heartbeat interval"
            value={`${statusData.heartbeatIntervalSeconds}s (owned by the wearable)`}
          />

          <View style={[styles.divider, { backgroundColor: palette.border }]} />

          <InfoRow label="Latest posture" value={''} />
          <View style={styles.badgeRow}>
            <PostureBadge posture={parsePostureLabel(statusData.latestPosture)} short />
          </View>
          <InfoRow label="Latest angle" value={formatDegrees(statusData.latestAngle)} />
          <InfoRow
            label="Latest confidence"
            value={
              statusData.latestConfidence === null
                ? '—'
                : formatPercent(statusData.latestConfidence * 100)
            }
          />
          <InfoRow
            label="Alert on latest"
            value={statusData.latestAlert ? 'Yes' : 'No'}
            tone={statusData.latestAlert ? 'warning' : 'neutral'}
          />
          <InfoRow label="Latest measurement at" value={formatRelative(statusData.latestTelemetryAt)} />

          {status.error !== null && (
            <Text style={[styles.note, { color: palette.error }]}>
              Showing the last successful reading. Refresh failed: {status.error.message}
            </Text>
          )}
        </SectionCard>
      )}

      {/* ---------------- All known devices ---------------- */}
      <SectionCard title="Devices known to the backend">
        {devices.loading && devices.data === null ? (
          <Text style={[styles.note, { color: palette.textMuted }]}>Loading devices…</Text>
        ) : devices.error && devices.data === null ? (
          <ErrorState error={devices.error} onRetry={devices.reload} compact />
        ) : devices.data === null || devices.data.devices.length === 0 ? (
          <Text style={[styles.note, { color: palette.textMuted }]}>
            The backend returned no device records.
          </Text>
        ) : (
          devices.data.devices.map((device) => (
            <View key={device.deviceId} style={styles.deviceRow}>
              <View style={styles.deviceRowMain}>
                <Text style={[styles.deviceName, { color: palette.text }]}>
                  {device.name ?? device.deviceId}
                </Text>
                <Text style={[styles.deviceMeta, { color: palette.textMuted }]}>
                  {device.deviceId} · {formatRelative(device.lastSeen)}
                </Text>
              </View>
              <StatusPill
                label={DEVICE_STATUS_LABEL[device.status]}
                tone={DEVICE_STATUS_TONE[device.status]}
              />
            </View>
          ))
        )}
      </SectionCard>

      {/* ---------------- Client configuration ---------------- */}
      <SectionCard
        title="App configuration"
        subtitle="Polling intervals used by this app. Change the backend address with EXPO_PUBLIC_API_URL."
      >
        <InfoRow label="Device id" value={DEVICE_ID} />
        <InfoRow label="Current posture poll" value={`${LIVE_POLL_INTERVAL_MS / 1000}s`} />
        <InfoRow label="Device status poll" value={`${STATUS_POLL_INTERVAL_MS / 1000}s`} />
        <InfoRow label="Summary poll" value={`${SUMMARY_POLL_INTERVAL_MS / 1000}s`} />
        <InfoRow label="Health poll" value={`${HEALTH_POLL_INTERVAL_MS / 1000}s`} />
        <Button mode="text" onPress={refresh} textColor={palette.primary} style={styles.refreshBtn}>
          Refresh now
        </Button>
      </SectionCard>

      <Text style={[styles.footer, { color: palette.textMuted }]}>
        Heartbeats and measurements are produced by the ESP32 wearable. This app only reads what the
        backend already stored.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  note: { fontSize: 12, lineHeight: 17, marginTop: 8 },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  deviceId: { fontSize: 11 },
  divider: { height: 1, marginVertical: 8 },
  badgeRow: { flexDirection: 'row', paddingBottom: 6 },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    gap: 10,
  },
  deviceRowMain: { flex: 1 },
  deviceName: { fontSize: 14, fontWeight: '600' },
  deviceMeta: { fontSize: 11, marginTop: 2 },
  refreshBtn: { alignSelf: 'flex-start', marginTop: 8 },
  footer: { fontSize: 11, lineHeight: 16 },
});
