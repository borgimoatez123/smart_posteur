import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../../src/theme/ThemeProvider';
import { useBackendHealth } from '../../src/hooks/useBackendHealth';
import { useCurrentPosture, useDashboardSummary } from '../../src/hooks/useDashboard';
import type { DashboardPeriod } from '../../src/api/types';
import { BackendStatusBar } from '../../src/components/BackendStatusBar';
import { ErrorState } from '../../src/components/ErrorState';
import { LoadingState } from '../../src/components/LoadingState';
import { EmptyState } from '../../src/components/EmptyState';
import { PostureBadge } from '../../src/components/PostureBadge';
import { StatusPill } from '../../src/components/StatusPill';
import { PeriodSelector } from '../../src/components/PeriodSelector';
import { StatisticCard } from '../../src/components/StatisticCard';
import { SectionCard, InfoRow } from '../../src/components/InfoCard';
import {
  DEVICE_STATUS_LABEL,
  DEVICE_STATUS_TONE,
  POSTURE_LABEL,
  POSTURE_SHORT_LABEL,
  getPostureDisplayLabel,
  isUnclassified,
  parsePostureLabel,
} from '../../src/utils/postureDisplay';
import { PostureClass } from '../../src/types/posture';
import {
  formatBatteryLevel,
  formatDegrees,
  formatDurationHuman,
  formatPercent,
  formatRelative,
} from '../../src/utils/format';

/**
 * Screen A — Dashboard.
 *
 * Every value on this screen comes from the backend REST API. Nothing is
 * inferred locally: the wearable's online state is decided by the server
 * (heartbeat/telemetry age), never by the phone's own reachability.
 */
export default function DashboardScreen() {
  const router = useRouter();
  const { palette } = useAppTheme();
  const [period, setPeriod] = useState<DashboardPeriod>('day');

  const health = useBackendHealth();
  const current = useCurrentPosture();
  const summary = useDashboardSummary(period);

  const reloadAll = useCallback(async () => {
    await Promise.all([health.reload(), current.reload(), summary.reload()]);
  }, [health, current, summary]);

  const refreshing =
    (health.refreshing || current.refreshing || summary.refreshing) &&
    (health.data !== null || current.data !== null);

  const posture = useMemo(() => parsePostureLabel(current.data?.posture), [current.data?.posture]);

  // Backend unreachable and nothing cached yet: the whole screen is unusable.
  if (health.error && health.data === null && current.data === null) {
    return (
      <ScrollView
        style={[styles.container, { backgroundColor: palette.background }]}
        contentContainerStyle={styles.flexGrow}
      >
        <ErrorState error={health.error} onRetry={reloadAll} />
      </ScrollView>
    );
  }

  const initialLoading = current.loading && current.data === null && summary.loading && summary.data === null;

  if (initialLoading) {
    return (
      <View style={[styles.container, { backgroundColor: palette.background }]}>
        <LoadingState message="Loading posture data from the backend…" />
      </View>
    );
  }

  const currentData = current.data;
  const summaryData = summary.data;

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

      {/* ---------------- Current posture ---------------- */}
      {currentData === null ? (
        current.error ? (
          <ErrorState error={current.error} onRetry={current.reload} compact />
        ) : null
      ) : !currentData.available ? (
        <EmptyState
          icon="📭"
          title="No measurements yet"
          message={
            currentData.message ??
            'The backend has not received any posture measurement from the wearable yet.'
          }
        />
      ) : (
        <SectionCard title="Current posture">
          <View style={styles.postureHeader}>
            <PostureBadge
              posture={posture}
              size="lg"
              emptyLabel={POSTURE_LABEL[PostureClass.UNKNOWN]}
            />
            <StatusPill
              label={DEVICE_STATUS_LABEL[currentData.deviceStatus]}
              tone={DEVICE_STATUS_TONE[currentData.deviceStatus]}
            />
          </View>

          {isUnclassified(posture) && (
            <Text style={[styles.note, { color: palette.textMuted }]}>
              The wearable could not classify this measurement, so it is labelled “User moves
              right now”. It is counted as neither good nor bad posture.
            </Text>
          )}

          <InfoRow label="Angle" value={formatDegrees(currentData.angle)} />
          <InfoRow
            label="Confidence"
            value={
              currentData.confidence === null
                ? '—'
                : formatPercent(currentData.confidence * 100)
            }
            hint="Classification confidence reported by the wearable."
          />
          <InfoRow label="Battery" value={formatBatteryLevel(currentData.battery)} />
          <InfoRow
            label="Sensor"
            value={currentData.sensorError ? 'Error reported' : 'OK'}
            tone={currentData.sensorError ? 'danger' : 'good'}
            hint="MPU6050 status reported by the wearable."
          />
          <InfoRow
            label="Last measurement"
            value={formatRelative(currentData.timestamp)}
            hint={currentData.timestamp ?? undefined}
          />
          <InfoRow
            label="Alert flag"
            value={currentData.alert ? 'Active on last measurement' : 'Not active'}
            tone={currentData.alert ? 'warning' : 'neutral'}
            hint="Set by the wearable, not inferred from the posture label."
          />

          {current.error !== null && (
            <Text style={[styles.note, { color: palette.error }]}>
              Showing the last successful reading — the most recent refresh failed:{' '}
              {current.error.message}
            </Text>
          )}
        </SectionCard>
      )}

      {/* ---------------- Period summary ---------------- */}
      <PeriodSelector value={period} onChange={setPeriod} />

      {summaryData === null ? (
        summary.error ? (
          <ErrorState error={summary.error} onRetry={summary.reload} compact />
        ) : (
          <LoadingState message="Loading summary…" />
        )
      ) : !summaryData.hasData ? (
        <EmptyState
          icon="📉"
          title="No data for this period"
          message={
            summaryData.message ??
            'The backend has no measurements in the selected period, so no statistics can be shown.'
          }
        />
      ) : (
        <>
          <View style={styles.row}>
            <StatisticCard
              label="Good posture"
              value={formatPercent(summaryData.totals.goodPosturePercentage)}
              hint="Share of monitored time"
            />
            <View style={styles.gap} />
            <StatisticCard
              label="Monitored"
              value={formatDurationHuman(summaryData.totals.monitoredDurationSeconds)}
              hint={`${summaryData.totals.measurements} measurements`}
            />
          </View>

          <View style={styles.row}>
            <StatisticCard
              label="Incorrect events"
              value={summaryData.totals.incorrectPostureEvents}
              hint="Recorded by the backend"
            />
            <View style={styles.gap} />
            <StatisticCard
              label="Average angle"
              value={summaryData.totals.averageAngle === null ? '—' : formatDegrees(summaryData.totals.averageAngle)}
            />
          </View>

          <SectionCard title="Posture distribution">
            {summaryData.postureDistribution.length === 0 ? (
              <Text style={[styles.note, { color: palette.textMuted }]}>
                The backend returned no distribution for this period.
              </Text>
            ) : (
              summaryData.postureDistribution.map((entry) => {
                const parsed = parsePostureLabel(entry.label);
                const displayLabel =
                  parsed === null ? getPostureDisplayLabel(entry.label) : POSTURE_SHORT_LABEL[parsed];
                return (
                <View key={entry.label} style={styles.distributionRow}>
                  <Text
                    style={[styles.distributionLabel, { color: palette.text }]}
                    numberOfLines={2}
                  >
                    {displayLabel}
                  </Text>
                  <View style={[styles.track, { backgroundColor: palette.surfaceElevated }]}>
                    <View
                      style={[
                        styles.fill,
                        {
                          width: `${Math.max(0, Math.min(100, entry.percentage))}%`,
                          backgroundColor: palette.primary,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.distributionValue, { color: palette.textSecondary }]}>
                    {formatPercent(entry.percentage)} · {entry.count}
                  </Text>
                </View>
                );
              })
            )}
          </SectionCard>

          <Text style={[styles.footerNote, { color: palette.textMuted }]}>
            Durations are derived by the backend from timestamp deltas between consecutive
            measurements, not from measurement counts.
          </Text>
        </>
      )}

      {/* ---------------- Navigation ---------------- */}
      <SectionCard title="Explore">
        <View style={styles.actions}>
          <Button
            mode="outlined"
            icon="chart-areaspline"
            onPress={() => router.push('/analytics')}
            textColor={palette.primary}
            style={[styles.actionBtn, { borderColor: palette.primary }]}
          >
            Analytics
          </Button>
          <Button
            mode="outlined"
            icon="timer-outline"
            onPress={() => router.push('/sessions')}
            textColor={palette.primary}
            style={[styles.actionBtn, { borderColor: palette.primary }]}
          >
            Sessions
          </Button>
          <Button
            mode="outlined"
            icon="bell-outline"
            onPress={() => router.push('/events')}
            textColor={palette.primary}
            style={[styles.actionBtn, { borderColor: palette.primary }]}
          >
            Events
          </Button>
          <Button
            mode="outlined"
            icon="robot-outline"
            onPress={() => router.push('/ai')}
            textColor={palette.primary}
            style={[styles.actionBtn, { borderColor: palette.primary }]}
          >
            AI tips
          </Button>
        </View>
      </SectionCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  flexGrow: { flexGrow: 1 },
  row: { flexDirection: 'row' },
  gap: { width: 12 },
  postureHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  note: { fontSize: 12, lineHeight: 17, marginTop: 8 },
  distributionRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  distributionLabel: { width: 104, fontSize: 12 },
  track: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  distributionValue: { width: 78, textAlign: 'right', fontSize: 11 },
  footerNote: { fontSize: 11, lineHeight: 16, marginTop: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionBtn: { borderRadius: 12 },
});
