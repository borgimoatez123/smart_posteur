import React, { useCallback, useMemo } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Polyline } from 'react-native-svg';
import { useAppTheme } from '../../src/theme/ThemeProvider';
import { useCurrentPosture } from '../../src/hooks/useDashboard';
import { usePostureHistory } from '../../src/hooks/usePostureHistory';
import { ErrorState } from '../../src/components/ErrorState';
import { LoadingState } from '../../src/components/LoadingState';
import { EmptyState } from '../../src/components/EmptyState';
import { PostureBadge } from '../../src/components/PostureBadge';
import { StatusPill } from '../../src/components/StatusPill';
import { SectionCard, InfoRow } from '../../src/components/InfoCard';
import {
  DEVICE_STATUS_LABEL,
  DEVICE_STATUS_TONE,
  POSTURE_LABEL,
  getPostureDisplayLabel,
  isUnclassified,
  parsePostureLabel,
} from '../../src/utils/postureDisplay';
import { PostureClass } from '../../src/types/posture';
import {
  formatDegrees,
  formatNumber,
  formatPercent,
  formatRelative,
  formatTime,
} from '../../src/utils/format';

const CHART_WIDTH = 300;
const CHART_HEIGHT = 110;
const PADDING = 12;
const RECENT_SAMPLE_COUNT = 40;

/**
 * Screen B — Posture monitoring.
 *
 * The values shown are the newest measurements *stored by the backend*, polled
 * every few seconds. This is not a raw Bluetooth stream, and one measurement is
 * never interpreted as one second of time.
 */
export default function MonitorScreen() {
  const { palette } = useAppTheme();

  const current = useCurrentPosture();
  const history = usePostureHistory({ limit: RECENT_SAMPLE_COUNT, sort: 'desc' });

  const reloadAll = useCallback(async () => {
    await Promise.all([current.reload(), history.refresh()]);
  }, [current, history]);

  const refreshing = (current.refreshing || history.refreshing) && current.data !== null;

  // History is newest-first; the chart draws oldest → newest.
  const samples = useMemo(() => {
    return history.items
      .map((record) => ({ timestamp: record.timestamp, angle: record.posture.angle }))
      .slice()
      .reverse();
  }, [history.items]);

  const posture = parsePostureLabel(current.data?.posture);

  if (current.error && current.data === null) {
    return (
      <ScrollView
        style={[styles.container, { backgroundColor: palette.background }]}
        contentContainerStyle={styles.flexGrow}
      >
        <ErrorState error={current.error} onRetry={reloadAll} />
      </ScrollView>
    );
  }

  if (current.loading && current.data === null) {
    return (
      <View style={[styles.container, { backgroundColor: palette.background }]}>
        <LoadingState message="Loading the latest posture measurement…" />
      </View>
    );
  }

  const data = current.data;

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
      {data === null || !data.available ? (
        <EmptyState
          icon="📡"
          title="No measurements available"
          message={
            data?.message ??
            'The backend has not stored any posture measurement yet. Make sure the wearable is powered on and connected to the server.'
          }
        />
      ) : (
        <>
          {data.alert && (
            <View
              style={[
                styles.alertBanner,
                { backgroundColor: palette.posture.warning + '22', borderColor: palette.posture.warning },
              ]}
            >
              <Text style={[styles.alertText, { color: palette.posture.warning }]}>
                The wearable reports an active alert on the latest measurement.
              </Text>
            </View>
          )}

          {data.sensorError && (
            <View
              style={[
                styles.alertBanner,
                { backgroundColor: palette.posture.danger + '22', borderColor: palette.posture.danger },
              ]}
            >
              <Text style={[styles.alertText, { color: palette.posture.danger }]}>
                The wearable reported an MPU6050 sensor error on the latest measurement.
              </Text>
            </View>
          )}

          <SectionCard title="Latest measurement">
            <View style={styles.postureHeader}>
              <PostureBadge
                posture={posture}
                size="lg"
                emptyLabel={POSTURE_LABEL[PostureClass.UNKNOWN]}
              />
              <StatusPill
                label={DEVICE_STATUS_LABEL[data.deviceStatus]}
                tone={DEVICE_STATUS_TONE[data.deviceStatus]}
              />
            </View>

            {isUnclassified(posture) && (
              <Text style={[styles.note, { color: palette.textMuted }]}>
                The wearable could not classify this measurement, so it is labelled “User moves
                right now”. It is counted as neither good nor bad.
              </Text>
            )}

            <InfoRow label="Angle" value={formatDegrees(data.angle)} />
            <InfoRow
              label="Confidence"
              value={data.confidence === null ? '—' : formatPercent(data.confidence * 100)}
            />
            <InfoRow label="Battery" value={data.battery === null ? '—' : formatPercent(data.battery)} />
            <InfoRow label="Measured at" value={formatTime(data.timestamp)} hint={data.timestamp ?? undefined} />
            <InfoRow label="Age" value={formatRelative(data.timestamp)} />
            <InfoRow label="Sampling rate" value={formatSamplingRate(history.items[0]?.samplingHz ?? null)} />
          </SectionCard>

          <SectionCard
            title="Recent angle"
            subtitle={`Last ${samples.length} stored measurement${samples.length === 1 ? '' : 's'} (oldest to newest).`}
          >
            <AngleSparkline samples={samples} />
          </SectionCard>
        </>
      )}

      <SectionCard title="Recent classifications">
        {history.loading && history.items.length === 0 ? (
          <LoadingState message="Loading recent measurements…" />
        ) : history.error && history.items.length === 0 ? (
          <ErrorState error={history.error} onRetry={history.refresh} compact />
        ) : history.items.length === 0 ? (
          <Text style={[styles.note, { color: palette.textMuted }]}>
            The backend has no stored measurements for this device yet.
          </Text>
        ) : (
          history.items.slice(0, 10).map((record) => (
            <View key={record.id} style={styles.sampleRow}>
              <PostureBadge
                posture={parsePostureLabel(record.posture.label)}
                size="sm"
                short
                emptyLabel={getPostureDisplayLabel(record.posture.label)}
              />
              <Text style={[styles.sampleTime, { color: palette.textSecondary }]}>
                {formatRelative(record.timestamp)}
              </Text>
              <Text style={[styles.sampleAngle, { color: palette.text }]}>
                {formatDegrees(record.posture.angle)}
              </Text>
            </View>
          ))
        )}
      </SectionCard>

      <Text style={[styles.footerNote, { color: palette.textMuted }]}>
        This screen reads measurements the backend already received from the wearable. The app
        never contacts the wearable directly and never sends heartbeats on its behalf.
      </Text>
    </ScrollView>
  );
}

function formatSamplingRate(hz: number | null): string {
  if (hz === null) return '—';
  return `${formatNumber(hz, 1)} Hz`;
}

interface SparklineProps {
  samples: { timestamp: string; angle: number }[];
}

/** Simple line of the measured angle over the most recent stored samples. */
function AngleSparkline({ samples }: SparklineProps) {
  const { palette } = useAppTheme();

  if (samples.length < 2) {
    return (
      <View style={styles.chartPlaceholder}>
        <Text style={[styles.note, { color: palette.textMuted }]}>
          At least two stored measurements are required to draw this chart.
        </Text>
      </View>
    );
  }

  const innerW = CHART_WIDTH - PADDING * 2;
  const innerH = CHART_HEIGHT - PADDING * 2;
  const bound = (value: number) => Math.max(-90, Math.min(90, value));
  const yFor = (value: number) => PADDING + innerH / 2 - (bound(value) / 90) * (innerH / 2);

  const points = samples
    .map((sample, index) => {
      const x = PADDING + (index / (samples.length - 1)) * innerW;
      return `${x},${yFor(sample.angle)}`;
    })
    .join(' ');

  const midY = PADDING + innerH / 2;

  return (
    <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
      <Line
        x1={PADDING}
        y1={midY}
        x2={CHART_WIDTH - PADDING}
        y2={midY}
        stroke={palette.border}
        strokeWidth={1}
        strokeDasharray="4 4"
      />
      <Polyline points={points} fill="none" stroke={palette.teal} strokeWidth={2} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  flexGrow: { flexGrow: 1 },
  postureHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  note: { fontSize: 12, lineHeight: 17, marginTop: 6 },
  alertBanner: { padding: 12, borderRadius: 12, borderWidth: 1 },
  alertText: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  chartPlaceholder: { height: CHART_HEIGHT, justifyContent: 'center' },
  sampleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    gap: 8,
  },
  sampleTime: { flex: 1, fontSize: 12, textAlign: 'right' },
  sampleAngle: { fontSize: 13, fontWeight: '700', width: 64, textAlign: 'right' },
  footerNote: { fontSize: 11, lineHeight: 16 },
});
