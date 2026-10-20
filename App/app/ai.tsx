import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Button } from 'react-native-paper';
import { useAppTheme } from '../src/theme/ThemeProvider';
import { useLiveRecommendation } from '../src/hooks/useLiveRecommendation';
import { useRecommendations } from '../src/hooks/useRecommendations';
import { useDeviceStatus } from '../src/hooks/useDeviceStatus';
import { DEVICE_ID, LIVE_AI_WINDOW_MINUTES } from '../src/config/appConfig';
import type { DashboardPeriod, DeviceStatusView, LiveRecommendationView } from '../src/api/types';
import { ErrorState } from '../src/components/ErrorState';
import { LoadingState } from '../src/components/LoadingState';
import { EmptyState } from '../src/components/EmptyState';
import { PeriodSelector } from '../src/components/PeriodSelector';
import { PostureBadge } from '../src/components/PostureBadge';
import { StatusPill } from '../src/components/StatusPill';
import { StatisticCard } from '../src/components/StatisticCard';
import { SectionCard, InfoRow } from '../src/components/InfoCard';
import {
  DEVICE_STATUS_LABEL,
  DEVICE_STATUS_TONE,
  LIVE_QUALITY_HINT,
  LIVE_QUALITY_LABEL,
  LIVE_QUALITY_TONE,
  LIVE_SOURCE_LABEL,
  LIVE_SOURCE_TONE,
  PRIORITY_LABEL,
  PRIORITY_TONE,
  RECOMMENDATION_STATUS_LABEL,
  getPostureDisplayLabel,
  parsePostureLabel,
} from '../src/utils/postureDisplay';
import {
  formatDateTime,
  formatDegrees,
  formatDurationHuman,
  formatPercent,
  formatRelative,
  formatSecondsAgo,
} from '../src/utils/format';

/**
 * Screen G — AI posture coach.
 *
 * The live section is a coach, not a report. It answers, in order: where am I
 * right now, what should I do next, why it matters, and a little context.
 *
 * The wording comes from `GET /ai/recommendations/live`, which answers HTTP 200
 * for every state, so this screen reads `available` / `stale` / `dataQuality` /
 * `source` instead of assuming that a resolved request contains live data.
 *
 * Stored analysis (`POST /ai/recommendations`, `GET /ai/recommendations/latest`)
 * is a separate, period-based feature kept below. A missing stored result never
 * affects the live coaching above.
 */
export default function RecommendationsScreen() {
  const { palette } = useAppTheme();
  const router = useRouter();
  const [period, setPeriod] = useState<DashboardPeriod>('day');

  const live = useLiveRecommendation(DEVICE_ID, LIVE_AI_WINDOW_MINUTES);
  const device = useDeviceStatus(DEVICE_ID);
  const historical = useRecommendations(period);

  const liveData = live.data;
  const data = historical.data;
  const error = historical.error;

  const reloadAll = useCallback(async () => {
    await Promise.all([live.reload(), device.reload(), historical.reloadLatest()]);
  }, [live, device, historical]);

  const onGenerate = useCallback(
    async (refresh: boolean) => {
      await historical.generate(refresh);
    },
    [historical],
  );

  const refreshing =
    (live.refreshing || historical.loading) && (liveData !== null || data !== null);

  const unavailableCodes = new Set(['NO_POSTURE_DATA', 'GEMINI_NOT_CONFIGURED']);

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Posture coach' }} />
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
        {/* ---------------- Live coaching ---------------- */}
        <Text style={[styles.screenTitle, { color: palette.text }]}>Your posture coach</Text>
        <Text style={[styles.screenSubtitle, { color: palette.textMuted }]}>
          Short, personal advice from the telemetry the backend stored over the last{' '}
          {LIVE_AI_WINDOW_MINUTES} minutes. Nothing here is invented — when there is no data to
          work with, the screen says so.
        </Text>

        {live.loading && liveData === null ? (
          <LoadingState message="Reading your recent posture…" />
        ) : liveData === null ? (
          live.error ? (
            <ErrorState error={live.error} onRetry={live.reload} />
          ) : (
            <EmptyState
              icon="🤖"
              title="No live coaching"
              message="The backend returned no live coaching payload."
              action={
                <Button mode="outlined" onPress={live.reload} textColor={palette.primary}>
                  Retry
                </Button>
              }
            />
          )
        ) : (
          <>
            <CoachingContent
              view={liveData}
              deviceStatus={device.data}
              onRefresh={live.reload}
              onOpenAnalytics={() => router.push('/analytics')}
            />

            {live.error !== null && <ErrorState error={live.error} onRetry={live.reload} compact />}

            <Text style={[styles.footerNote, { color: palette.textMuted }]}>
              Coaching updated {formatRelative(liveData.generatedAt)}
              {liveData.cached ? ' · served from the backend cache' : ''}
              {live.lastUpdatedAt === null
                ? ''
                : ` · last checked ${formatRelative(new Date(live.lastUpdatedAt).toISOString())}`}
              .
            </Text>
          </>
        )}

        {/* ---------------- Historical analysis ---------------- */}
        <Text style={[styles.sectionHeading, { color: palette.text }]}>Stored analysis</Text>
        <Text style={[styles.sectionSubheading, { color: palette.textMuted }]}>
          Period-based recommendations generated on demand and stored as history. Separate from the
          live coaching above.
        </Text>

        <PeriodSelector value={period} onChange={setPeriod} />

        <SectionCard
          title="Analysis window"
          subtitle="Recommendations are generated from the backend's aggregated statistics for the selected period."
        >
          <InfoRow label="Period" value={period} />
          <InfoRow
            label="Stored result"
            value={
              data === null
                ? 'None stored'
                : `${formatRelative(data.generatedAt)} · ${formatDateTime(data.generatedAt)}`
            }
          />
          <InfoRow
            label="AI configured"
            value={data === null ? '—' : data.aiConfigured ? 'Yes' : 'No'}
            tone={data !== null && !data.aiConfigured ? 'warning' : undefined}
            hint="Whether the backend has a Gemini API key configured."
          />
          <InfoRow label="Model" value={data?.model ?? '—'} />

          <View style={styles.actions}>
            <Button
              mode="contained"
              icon="robot"
              loading={historical.generating}
              disabled={historical.generating}
              onPress={() => void onGenerate(false)}
              style={[styles.actionBtn, { backgroundColor: palette.primary }]}
              labelStyle={{ color: palette.onPrimary }}
            >
              Generate
            </Button>
            <Button
              mode="outlined"
              icon="refresh"
              disabled={historical.generating}
              onPress={() => void onGenerate(true)}
              textColor={palette.primary}
              style={[styles.actionBtn, { borderColor: palette.primary }]}
            >
              Regenerate (ignore cache)
            </Button>
          </View>

          <Text style={[styles.note, { color: palette.textMuted }]}>
            Generate uses the backend cache when a fresh analysis already exists. Regenerate forces
            a brand new Gemini call for the current statistics.
          </Text>
        </SectionCard>

        {historical.notice !== null && (
          <SectionCard
            title={
              data?.status !== 'success'
                ? 'Analysis unavailable'
                : data.cached
                  ? 'Cached result'
                  : 'Fresh result'
            }
            subtitle={historical.notice}
          >
            <Text style={[styles.note, { color: palette.textMuted }]}>
              {data?.status !== 'success'
                ? 'No successful analysis was produced, so nothing here should be read as a Gemini recommendation.'
                : data?.cached
                  ? 'This answer was served from the backend cache; Gemini was not called again.'
                  : 'This answer was produced by a Gemini call triggered by your request.'}
            </Text>
          </SectionCard>
        )}

        {error !== null && unavailableCodes.has(error.code) ? (
          <EmptyState
            icon={error.code === 'NO_POSTURE_DATA' ? '📭' : '🔌'}
            title={error.code === 'NO_POSTURE_DATA' ? 'No posture data yet' : 'AI not configured'}
            message={error.message}
            action={
              <Button
                mode="outlined"
                onPress={historical.reloadLatest}
                textColor={palette.primary}
              >
                Reload stored result
              </Button>
            }
          />
        ) : error !== null && data === null ? (
          <ErrorState error={error} onRetry={() => void onGenerate(false)} />
        ) : historical.loading && data === null ? (
          <LoadingState message="Loading stored recommendation…" />
        ) : data === null ? (
          <EmptyState
            icon="🤖"
            title="No recommendation yet"
            message="No stored recommendation exists for this period. Generate one to ask the backend to analyse the aggregated statistics."
            action={
              <Button
                mode="contained"
                onPress={() => void onGenerate(false)}
                style={{ backgroundColor: palette.primary }}
                labelStyle={{ color: palette.onPrimary }}
              >
                Generate
              </Button>
            }
          />
        ) : (
          <>
            <SectionCard title="Status">
              <View style={styles.statusRow}>
                <StatusPill
                  label={RECOMMENDATION_STATUS_LABEL[data.status]}
                  tone={
                    data.status === 'success'
                      ? 'good'
                      : data.status === 'error'
                        ? 'danger'
                        : 'neutral'
                  }
                />
                {data.cached && <StatusPill label="Cached" tone="warning" />}
              </View>
              {data.error !== null && (
                <Text style={[styles.note, { color: palette.error }]}>{data.error}</Text>
              )}
              {data.status !== 'success' && (
                <Text style={[styles.note, { color: palette.textMuted }]}>
                  The backend did not produce a successful analysis for this period.
                </Text>
              )}
            </SectionCard>

            {data.summary !== null && data.summary.length > 0 && (
              <SectionCard title="Summary">
                <Text style={[styles.summary, { color: palette.text }]}>{data.summary}</Text>
              </SectionCard>
            )}

            <SectionCard title={`Recommendations (${data.recommendations.length})`}>
              {data.recommendations.length === 0 ? (
                <Text style={[styles.note, { color: palette.textMuted }]}>
                  The backend returned no individual recommendations for this period.
                </Text>
              ) : (
                data.recommendations.map((item, index) => (
                  <View
                    key={`${index}-${item.title}`}
                    style={[styles.tip, { borderColor: palette.border }]}
                  >
                    <View style={styles.tipHeader}>
                      <Text style={[styles.tipTitle, { color: palette.text }]}>{item.title}</Text>
                      <StatusPill
                        label={PRIORITY_LABEL[item.priority]}
                        tone={PRIORITY_TONE[item.priority]}
                      />
                    </View>
                    <Text style={[styles.tipDetail, { color: palette.textSecondary }]}>
                      {item.detail}
                    </Text>
                  </View>
                ))
              )}
            </SectionCard>

            <Text style={[styles.disclaimer, { color: palette.textMuted }]}>{data.disclaimer}</Text>
          </>
        )}

        <Text style={[styles.footerNote, { color: palette.textMuted }]}>
          This screen does not diagnose anything. It displays what the backend returned and keeps the
          live coaching separate from the stored period analysis.
        </Text>
      </ScrollView>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Live coaching                                                       */
/* ------------------------------------------------------------------ */

interface CoachingContentProps {
  view: LiveRecommendationView;
  deviceStatus: DeviceStatusView | null;
  onRefresh: () => void;
  onOpenAnalytics: () => void;
}

/**
 * The coaching view, ordered as the brief asks:
 *   A — current status, B — next action, C — future self, D — recent context.
 *
 * Every branch is driven by the response fields. The endpoint answers HTTP 200
 * for "nothing to report", so a resolved request is never treated as data.
 */
function CoachingContent({ view, deviceStatus, onRefresh, onOpenAnalytics }: CoachingContentProps) {
  const { palette } = useAppTheme();

  // State E — no telemetry inside the window. Nothing is invented to fill it.
  if (!view.available || view.dataQuality === 'none' || view.source === 'none') {
    return (
      <SectionCard
        title="No recent telemetry"
        subtitle={`The backend looked at the last ${view.windowMinutes} minute(s) for ${
          view.deviceId ?? DEVICE_ID
        }.`}
      >
        <EmptyState
          icon="📡"
          title="Nothing to coach on yet"
          message={`${view.message} No posture, angle or advice is shown, because none of it could be derived from real measurements.`}
        />

        <InfoRow
          label="Wearable status"
          value={
            deviceStatus === null
              ? 'Not reported by the backend'
              : DEVICE_STATUS_LABEL[deviceStatus.status]
          }
          tone={deviceStatus === null ? 'neutral' : DEVICE_STATUS_TONE[deviceStatus.status]}
          hint="Read from the device-status endpoint, never inferred from missing telemetry."
        />
        {deviceStatus !== null && (
          <InfoRow
            label="Last device contact"
            value={formatSecondsAgo(deviceStatus.secondsSinceLastSeen)}
          />
        )}

        <Text style={[styles.note, { color: palette.textMuted }]}>
          {deviceStatus === null
            ? 'The backend did not report a device status either, so the wearable state is unknown.'
            : deviceStatus.status === 'online'
              ? `The backend reports the wearable as online, yet no measurement arrived in the last ${view.windowMinutes} minute(s).`
              : deviceStatus.status === 'offline'
                ? 'The backend reports the wearable as offline, which explains the missing measurements.'
                : 'The backend has not decided whether the wearable is online or offline.'}
        </Text>

        <View style={styles.actions}>
          <Button
            mode="outlined"
            icon="refresh"
            onPress={onRefresh}
            textColor={palette.primary}
            style={[styles.actionBtn, { borderColor: palette.primary }]}
          >
            Check again
          </Button>
        </View>
      </SectionCard>
    );
  }

  const current = view.current;
  const currentLabel = current === null ? null : getPostureDisplayLabel(current.posture);
  const advice = view.advice;

  return (
    <>
      {/* State C — stale telemetry is never presented as the current position. */}
      {view.stale && (
        <View
          style={[
            styles.banner,
            { backgroundColor: palette.posture.warning + '22', borderColor: palette.posture.warning },
          ]}
        >
          <Text style={[styles.bannerTitle, { color: palette.posture.warning }]}>
            Stale reading — last known posture
          </Text>
          <Text style={[styles.bannerText, { color: palette.posture.warning }]}>
            {view.message} What follows is the most recent data the backend has. It is not a picture
            of where you are now.
          </Text>
        </View>
      )}

      {/* ---------------- A — Current status ---------------- */}
      <SectionCard
        title={view.stale ? 'Last known posture' : 'Current status'}
        subtitle={
          view.stale
            ? 'Shown for context only. Do not read it as your current position.'
            : 'The newest measurement inside the analysed window.'
        }
      >
        <View style={styles.postureHeader}>
          <PostureBadge
            posture={current === null ? null : parsePostureLabel(current.posture)}
            size="lg"
            emptyLabel="No classified posture"
          />
          <View style={styles.pillStack}>
            <StatusPill
              label={view.stale ? 'Stale reading' : 'Fresh reading'}
              tone={view.stale ? 'warning' : 'good'}
            />
            <StatusPill
              label={LIVE_QUALITY_LABEL[view.dataQuality]}
              tone={LIVE_QUALITY_TONE[view.dataQuality]}
            />
          </View>
        </View>

        <Text style={[styles.postureLabel, { color: palette.text }]}>
          {currentLabel ?? 'No classified posture'}
        </Text>
        <Text style={[styles.note, { color: palette.textMuted }]}>
          {current !== null && current.posture === 'UNKNOWN'
            ? 'The wearable could not classify this reading, so it reads “User moves right now”. That is a display label, not a verified position, and it counts as neither good nor bad posture.'
            : 'Classification reported by the wearable. The app never re-classifies it.'}
        </Text>

        {/* State D — limited data is stated, explained and never read as failure. */}
        {view.dataQuality === 'limited' && (
          <Text style={[styles.note, { color: palette.textSecondary }]}>
            {LIVE_QUALITY_HINT.limited} {view.sampleCount} measurement
            {view.sampleCount === 1 ? '' : 's'} arrived in this window.
          </Text>
        )}

        <InfoRow
          label="Angle"
          value={formatDegrees(current?.angle ?? null)}
          hint="Degrees, as reported by the wearable."
        />
        <InfoRow
          label={view.stale ? 'Reading age' : 'Latest reading'}
          value={formatSecondsAgo(view.latestSampleAgeSeconds)}
          tone={view.stale ? 'warning' : undefined}
          hint={current?.timestamp ? formatDateTime(current.timestamp) : undefined}
        />
      </SectionCard>

      {/* ---------------- B — Your next action (main focus) ---------------- */}
      {advice === null ? (
        <SectionCard title="Your next action">
          <Text style={[styles.note, { color: palette.textMuted }]}>
            The backend had telemetry for this window but returned no coaching text, so no advice is
            shown rather than inventing one.
          </Text>
        </SectionCard>
      ) : (
        <SectionCard title="Your next action" style={[styles.focusCard, { borderColor: palette.primary }]}>
          <View style={styles.statusRow}>
            <StatusPill
              label={PRIORITY_LABEL[advice.priority]}
              tone={PRIORITY_TONE[advice.priority]}
            />
            <StatusPill label={LIVE_SOURCE_LABEL[view.source]} tone={LIVE_SOURCE_TONE[view.source]} />
            {view.cached && <StatusPill label="Cached" tone="warning" />}
          </View>

          <Text style={[styles.actionTitle, { color: palette.text }]}>{advice.title}</Text>
          <Text style={[styles.actionText, { color: palette.textSecondary }]}>
            {advice.immediateAction}
          </Text>

          <Text style={[styles.adviceLabel, { color: palette.textMuted }]}>Why this advice</Text>
          <Text style={[styles.reason, { color: palette.textSecondary }]}>{advice.reason}</Text>

          {/* State E — a Gemini fallback is documented, not an error. */}
          {view.source === 'fallback' && (
            <Text style={[styles.note, { color: palette.textMuted }]}>
              {view.aiConfigured
                ? 'The AI service was unavailable for this request, so the backend used its standard posture coaching. The readings above are still real measurements.'
                : 'The AI service is not configured on the backend, so standard posture coaching is used. The readings above are still real measurements.'}
            </Text>
          )}
        </SectionCard>
      )}

      {/* ---------------- C — Your future self ---------------- */}
      {advice !== null && (
        <SectionCard title="Your future self">
          <Text style={[styles.futureText, { color: palette.textSecondary }]}>
            {advice.futureImpact}
          </Text>
        </SectionCard>
      )}

      {/* ---------------- D — Recent context ---------------- */}
      <SectionCard
        title="Recent context"
        subtitle={`From the last ${view.windowMinutes} minutes of real telemetry.`}
      >
        <View style={styles.row}>
          <StatisticCard
            label="Good posture"
            value={formatPercent(view.goodPosturePercentage)}
            hint="Share of monitored time"
          />
          <View style={styles.gap} />
          <StatisticCard
            label="Incorrect posture running"
            value={formatDurationHuman(view.persistentIncorrectSeconds)}
            hint="Continuous time in the current run"
          />
        </View>

        <Text style={[styles.adviceLabel, { color: palette.textMuted }]}>Posture mix in this window</Text>
        {view.postureDistribution.length === 0 ? (
          <Text style={[styles.note, { color: palette.textMuted }]}>
            The backend returned no distribution for this window.
          </Text>
        ) : (
          view.postureDistribution.map((entry) => {
            const label = getPostureDisplayLabel(entry.label);
            return (
              <View
                key={entry.label}
                style={styles.barRow}
                accessible
                accessibilityLabel={`${label}: ${formatPercent(entry.percentage)} of the window`}
              >
                <Text style={[styles.barLabel, { color: palette.text }]} numberOfLines={2}>
                  {label}
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
                  {formatPercent(entry.percentage)}
                </Text>
              </View>
            );
          })
        )}

        <Button
          mode="text"
          icon="chart-line"
          onPress={onOpenAnalytics}
          textColor={palette.primary}
          style={styles.analyticsLink}
        >
          Full detail in Analytics
        </Button>
      </SectionCard>

      <Text style={[styles.disclaimer, { color: palette.textMuted }]}>{view.disclaimer}</Text>
      <Text style={[styles.note, { color: palette.textMuted }]}>{view.message}</Text>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  screenTitle: { fontSize: 22, fontWeight: '700' },
  screenSubtitle: { fontSize: 12, lineHeight: 17, marginTop: -8 },
  sectionHeading: { fontSize: 18, fontWeight: '700', marginTop: 8 },
  sectionSubheading: { fontSize: 12, lineHeight: 17, marginTop: -8 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12, flexWrap: 'wrap' },
  actionBtn: { borderRadius: 12 },
  note: { fontSize: 12, lineHeight: 17, marginTop: 8 },
  statusRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  banner: { padding: 12, borderRadius: 12, borderWidth: 1 },
  bannerTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  bannerText: { fontSize: 13, lineHeight: 18 },
  summary: { fontSize: 14, lineHeight: 21, marginTop: 10 },
  focusCard: { borderWidth: 2 },
  postureHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  pillStack: { gap: 6, alignItems: 'flex-end' },
  postureLabel: { fontSize: 16, fontWeight: '700', marginTop: 10 },
  row: { flexDirection: 'row', marginTop: 4 },
  gap: { width: 12 },
  actionTitle: { fontSize: 18, fontWeight: '700', marginTop: 12 },
  actionText: { fontSize: 15, lineHeight: 22, marginTop: 6 },
  adviceLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 12,
  },
  reason: { fontSize: 13, lineHeight: 19, marginTop: 4 },
  futureText: { fontSize: 14, lineHeight: 21, marginTop: 4 },
  barRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  barLabel: { width: 104, fontSize: 12 },
  track: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  barValue: { width: 56, textAlign: 'right', fontSize: 11 },
  analyticsLink: { alignSelf: 'flex-start', marginTop: 8, marginLeft: -8 },
  tip: { borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 10 },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  tipTitle: { fontSize: 14, fontWeight: '700', flexShrink: 1 },
  tipDetail: { fontSize: 13, lineHeight: 19, marginTop: 6 },
  disclaimer: { fontSize: 11, lineHeight: 16, fontStyle: 'italic', marginTop: 8 },
  footerNote: { fontSize: 11, lineHeight: 16 },
});
