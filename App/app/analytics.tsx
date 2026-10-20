import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { useAppTheme } from '../src/theme/ThemeProvider';
import { useDashboardSummary } from '../src/hooks/useDashboard';
import type { DashboardPeriod } from '../src/api/types';
import { ErrorState } from '../src/components/ErrorState';
import { LoadingState } from '../src/components/LoadingState';
import { EmptyState } from '../src/components/EmptyState';
import { PeriodSelector } from '../src/components/PeriodSelector';
import { StatisticCard } from '../src/components/StatisticCard';
import { SectionCard } from '../src/components/InfoCard';
import {
  POSTURE_SHORT_LABEL,
  getPostureDisplayLabel,
  parsePostureLabel,
} from '../src/utils/postureDisplay';
import {
  formatDegrees,
  formatDurationHuman,
  formatPercent,
  formatRange,
  formatRelative,
} from '../src/utils/format';

/**
 * Screen C — Analytics.
 *
 * Everything is derived by the backend from stored measurements. The screen
 * never recomputes statistics locally and never invents buckets: when the
 * backend reports `hasData: false` an explicit empty state is shown instead.
 */
export default function AnalyticsScreen() {
  const { palette } = useAppTheme();
  const [period, setPeriod] = useState<DashboardPeriod>('day');
  const summary = useDashboardSummary(period);

  const reload = useCallback(async () => {
    await summary.reload();
  }, [summary]);

  const data = summary.data;

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Analytics' }} />
      <ScrollView
        style={[styles.container, { backgroundColor: palette.background }]}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={summary.refreshing}
            onRefresh={reload}
            tintColor={palette.primary}
            colors={[palette.primary]}
          />
        }
      >
        <PeriodSelector value={period} onChange={setPeriod} />

        {data === null ? (
          summary.error ? (
            <ErrorState error={summary.error} onRetry={reload} />
          ) : (
            <LoadingState message="Loading aggregated statistics…" />
          )
        ) : !data.hasData ? (
          <EmptyState
            icon="📉"
            title="No data for this period"
            message={
              data.message ??
              'The backend has no measurements in the selected period, so no statistics can be shown.'
            }
          />
        ) : (
          <>
            <SectionCard
              title="Monitoring window"
              subtitle={formatRange(data.range.from, data.range.to)}
            >
              <Text style={[styles.note, { color: palette.textMuted }]}>
                Period: {data.period} · {data.totals.measurements} measurements stored
                {data.deviceId ? ` · device ${data.deviceId}` : ''}
              </Text>
            </SectionCard>

            <View style={styles.row}>
              <StatisticCard
                label="Good posture"
                value={formatPercent(data.totals.goodPosturePercentage)}
                hint="Share of monitored time"
              />
              <View style={styles.gap} />
              <StatisticCard
                label="Monitored"
                value={formatDurationHuman(data.totals.monitoredDurationSeconds)}
                hint="From timestamp deltas"
              />
            </View>

            <View style={styles.row}>
              <StatisticCard
                label="Good time"
                value={formatDurationHuman(data.totals.goodDurationSeconds)}
              />
              <View style={styles.gap} />
              <StatisticCard
                label="Bad time"
                value={formatDurationHuman(data.totals.badDurationSeconds)}
              />
            </View>

            <View style={styles.row}>
              <StatisticCard
                label="Incorrect events"
                value={data.totals.incorrectPostureEvents}
                hint="Recorded by the backend"
              />
              <View style={styles.gap} />
              <StatisticCard
                label="Average angle"
                value={
                  data.totals.averageAngle === null
                    ? '—'
                    : formatDegrees(data.totals.averageAngle)
                }
              />
            </View>

            <SectionCard
              title="Posture distribution"
              subtitle="Measurements labelled “User moves right now” are reported but excluded from the good/bad split."
            >
              {data.postureDistribution.length === 0 ? (
                <Text style={[styles.note, { color: palette.textMuted }]}>
                  The backend returned no distribution for this period.
                </Text>
              ) : (
                data.postureDistribution.map((entry) => {
                  const parsed = parsePostureLabel(entry.label);
                  const displayLabel =
                    parsed === null
                      ? getPostureDisplayLabel(entry.label)
                      : POSTURE_SHORT_LABEL[parsed];
                  return (
                    <View key={entry.label} style={styles.barRow}>
                      <Text
                        style={[styles.barLabel, { color: palette.text }]}
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
                      <Text style={[styles.barValue, { color: palette.textSecondary }]}>
                        {formatPercent(entry.percentage)} · {entry.count}
                      </Text>
                    </View>
                  );
                })
              )}
            </SectionCard>

            <SectionCard
              title="Trend"
              subtitle="Good-posture share per bucket, as computed by the backend."
            >
              {data.trends.length === 0 ? (
                <Text style={[styles.note, { color: palette.textMuted }]}>
                  The backend returned no trend buckets for this period.
                </Text>
              ) : (
                data.trends.map((bucket) => (
                  <View key={`${bucket.start}-${bucket.label}`} style={styles.barRow}>
                    <Text style={[styles.barLabel, { color: palette.text }]} numberOfLines={1}>
                      {bucket.label}
                    </Text>
                    <View style={[styles.track, { backgroundColor: palette.surfaceElevated }]}>
                      <View
                        style={[
                          styles.fill,
                          {
                            width: `${Math.max(
                              0,
                              Math.min(100, bucket.goodPosturePercentage),
                            )}%`,
                            backgroundColor: palette.posture.good,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.barValue, { color: palette.textSecondary }]}>
                      {formatPercent(bucket.goodPosturePercentage)} · {bucket.measurements}
                    </Text>
                  </View>
                ))
              )}
            </SectionCard>

            <Text style={[styles.footerNote, { color: palette.textMuted }]}>
              Durations come from timestamp deltas between consecutive measurements
              (backend replay), not from measurement counts. Last successful refresh:{' '}
              {summary.lastUpdatedAt === null
                ? '—'
                : formatRelative(new Date(summary.lastUpdatedAt).toISOString())}
              .
            </Text>
          </>
        )}

        {data !== null && summary.error !== null && (
          <ErrorState error={summary.error} onRetry={reload} compact />
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  row: { flexDirection: 'row' },
  gap: { width: 12 },
  note: { fontSize: 12, lineHeight: 17 },
  barRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  barLabel: { width: 104, fontSize: 12 },
  track: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  barValue: { width: 84, textAlign: 'right', fontSize: 11 },
  footerNote: { fontSize: 11, lineHeight: 16, marginTop: 2 },
});
