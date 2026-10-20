import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useAppTheme } from '../../src/theme/ThemeProvider';
import { useResource } from '../../src/hooks/useResource';
import { getHistoryRecord } from '../../src/api/historyApi';
import { ErrorState } from '../../src/components/ErrorState';
import { LoadingState } from '../../src/components/LoadingState';
import { EmptyState } from '../../src/components/EmptyState';
import { PostureBadge } from '../../src/components/PostureBadge';
import { SectionCard, InfoRow } from '../../src/components/InfoCard';
import {
  getPostureDisplayLabel,
  isUnclassified,
  parsePostureLabel,
} from '../../src/utils/postureDisplay';
import {
  formatDateTime,
  formatDegrees,
  formatDurationHuman,
  formatNumber,
  formatPercent,
  formatRelative,
  formatTime,
} from '../../src/utils/format';

/** Screen D (detail) — a single stored telemetry record, `GET /history/:id`. */
export default function TelemetryDetailScreen() {
  const { palette } = useAppTheme();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === 'string' ? params.id : null;

  const record = useResource(
    (signal) => {
      if (id === null) {
        return Promise.reject(new Error('Missing measurement identifier.'));
      }
      return getHistoryRecord(id, signal);
    },
    { enabled: id !== null, deps: [id] },
  );

  if (id === null) {
    return (
      <View style={[styles.container, { backgroundColor: palette.background }]}>
        <Stack.Screen options={{ headerShown: true, title: 'Measurement' }} />
        <EmptyState icon="❓" title="Missing identifier" message="This measurement cannot be opened." />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: palette.background }]}
      contentContainerStyle={styles.content}
    >
      <Stack.Screen options={{ headerShown: true, title: 'Measurement' }} />

      {record.loading && record.data === null ? (
        <LoadingState message="Loading measurement…" />
      ) : record.error && record.data === null ? (
        <ErrorState error={record.error} onRetry={record.reload} />
      ) : record.data === null ? (
        <EmptyState icon="🗂" title="Not found" />
      ) : (
        <>
          <SectionCard title="Classification">
            <View style={styles.header}>
              <PostureBadge
                posture={parsePostureLabel(record.data.posture.label)}
                size="lg"
                emptyLabel={getPostureDisplayLabel(record.data.posture.label)}
              />
            </View>
            {isUnclassified(parsePostureLabel(record.data.posture.label)) && (
              <Text style={[styles.note, { color: palette.textMuted }]}>
                Measurements labelled “User moves right now” are excluded from good/bad posture
                durations.
              </Text>
            )}
            <InfoRow label="Device" value={record.data.deviceId} />
            <InfoRow label="Measured at" value={formatDateTime(record.data.timestamp)} />
            <InfoRow label="Age" value={formatRelative(record.data.timestamp)} />
            <InfoRow
              label="Received by backend"
              value={record.data.receivedAt === null ? '—' : formatDateTime(record.data.receivedAt)}
              hint="Server clock; may differ from the device clock."
            />
            <InfoRow label="Session" value={record.data.sessionId ?? 'No session linked'} />
          </SectionCard>

          <SectionCard title="Posture values">
            <InfoRow label="Angle" value={formatDegrees(record.data.posture.angle)} />
            <InfoRow
              label="Confidence"
              value={
                record.data.posture.confidence === null
                  ? '—'
                  : formatPercent(record.data.posture.confidence * 100)
              }
            />
            <InfoRow
              label="Incorrect-posture duration"
              value={formatDurationHuman(record.data.posture.badDurationSeconds)}
              hint="Reported by the wearable for this measurement."
            />
            <InfoRow
              label="Alert"
              value={record.data.alert ? 'Recorded' : 'Not recorded'}
              tone={record.data.alert ? 'warning' : 'neutral'}
            />
            <InfoRow
              label="Sensor error"
              value={record.data.sensorError ? 'Reported' : 'None'}
              tone={record.data.sensorError ? 'danger' : 'good'}
            />
            <InfoRow label="Battery" value={formatPercent(record.data.battery)} />
            <InfoRow
              label="Sampling rate"
              value={record.data.samplingHz === null ? '—' : `${formatNumber(record.data.samplingHz, 1)} Hz`}
            />
          </SectionCard>

          <SectionCard title="Raw sensors">
            {record.data.sensors === null ? (
              <Text style={[styles.note, { color: palette.textMuted }]}>
                The backend did not store raw sensor values for this measurement.
              </Text>
            ) : (
              <>
                <InfoRow label="Accel X" value={formatNumber(record.data.sensors.ax, 3)} />
                <InfoRow label="Accel Y" value={formatNumber(record.data.sensors.ay, 3)} />
                <InfoRow label="Accel Z" value={formatNumber(record.data.sensors.az, 3)} />
                <InfoRow label="Gyro X" value={formatNumber(record.data.sensors.gx, 3)} />
                <InfoRow label="Gyro Y" value={formatNumber(record.data.sensors.gy, 3)} />
                <InfoRow label="Gyro Z" value={formatNumber(record.data.sensors.gz, 3)} />
              </>
            )}
          </SectionCard>

          <Text style={[styles.footer, { color: palette.textMuted }]}>
            Record id {record.data.id} · fetched {formatTime(new Date(record.lastUpdatedAt ?? Date.now()).toISOString())}
          </Text>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  note: { fontSize: 12, lineHeight: 17, marginTop: 6 },
  footer: { fontSize: 10, textAlign: 'center' },
});
