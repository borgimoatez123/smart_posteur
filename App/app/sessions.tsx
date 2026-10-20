import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack } from 'expo-router';
import { Button } from 'react-native-paper';
import { useAppTheme } from '../src/theme/ThemeProvider';
import { useSessions } from '../src/hooks/useSessions';
import { createSession, endSession } from '../src/api/sessionsApi';
import { toApiError } from '../src/api/client';
import type { SessionView } from '../src/api/types';
import { DEVICE_ID } from '../src/config/appConfig';
import { ErrorState } from '../src/components/ErrorState';
import { LoadingState } from '../src/components/LoadingState';
import { EmptyState } from '../src/components/EmptyState';
import { StatusPill } from '../src/components/StatusPill';
import { SectionCard, InfoRow } from '../src/components/InfoCard';
import {
  formatDateTime,
  formatDegrees,
  formatDurationHuman,
  formatPercent,
  formatRelative,
} from '../src/utils/format';
import type { Tone } from '../src/utils/postureDisplay';

type StatusFilter = 'all' | 'active' | 'ended';

/**
 * Screen E — Monitoring sessions.
 *
 * Sessions are created and ended through the backend so its statistics replay
 * has an explicit window. The backend returns the already-active session with
 * `200` when one exists; that outcome is surfaced instead of silently creating
 * duplicates.
 */
export default function SessionsScreen() {
  const { palette } = useAppTheme();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [pending, setPending] = useState<'start' | 'end' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const sessions = useSessions({ status: statusFilter === 'all' ? undefined : statusFilter });

  const activeSession = useMemo(
    () => sessions.items.find((item) => item.status === 'active') ?? null,
    [sessions.items],
  );

  const startSession = useCallback(async () => {
    setPending('start');
    setActionError(null);
    setNotice(null);
    const activeBefore = sessions.items.find((item) => item.status === 'active') ?? null;
    try {
      const created = await createSession({ deviceId: DEVICE_ID });
      setNotice(
        activeBefore !== null && activeBefore.id === created.id
          ? `An active session already existed, so the backend returned it (started ${formatRelative(
              created.startedAt,
            )}). No duplicate was created.`
          : `Session started at ${formatDateTime(created.startedAt)}.`,
      );
      await sessions.refresh();
    } catch (caught) {
      setActionError(toApiError(caught).message);
    } finally {
      setPending(null);
    }
  }, [sessions]);

  const endActiveSession = useCallback(async () => {
    if (!activeSession) return;
    setPending('end');
    setActionError(null);
    setNotice(null);
    try {
      const ended = await endSession(activeSession.id);
      setNotice(
        ended.endedAt
          ? `Session ended at ${formatDateTime(ended.endedAt)}.`
          : 'Session closed by the backend.',
      );
      await sessions.refresh();
    } catch (caught) {
      setActionError(toApiError(caught).message);
    } finally {
      setPending(null);
    }
  }, [activeSession, sessions]);

  const listHeader = (
    <View style={styles.header}>
      <SectionCard
        title="Session control"
        subtitle="Starting or ending a session is stored on the backend and scopes its statistics replay."
      >
        <InfoRow
          label="Active session"
          value={activeSession ? formatRelative(activeSession.startedAt) : 'None'}
          tone={activeSession ? 'good' : 'neutral'}
          hint={activeSession ? `Started ${formatDateTime(activeSession.startedAt)}` : undefined}
        />
        <InfoRow label="Device" value={DEVICE_ID} hint="Fixed wearable identifier." />

        <View style={styles.actions}>
          <Button
            mode="contained"
            icon="play"
            loading={pending === 'start'}
            disabled={pending !== null}
            onPress={startSession}
            style={[styles.actionBtn, { backgroundColor: palette.primary }]}
            labelStyle={{ color: palette.onPrimary }}
          >
            Start session
          </Button>
          <Button
            mode="outlined"
            icon="stop"
            loading={pending === 'end'}
            disabled={pending !== null || activeSession === null}
            onPress={endActiveSession}
            textColor={activeSession ? palette.error : palette.textMuted}
            style={[styles.actionBtn, { borderColor: activeSession ? palette.error : palette.border }]}
          >
            End active session
          </Button>
        </View>

        {notice !== null && (
          <Text style={[styles.notice, { color: palette.posture.good }]}>{notice}</Text>
        )}
        {actionError !== null && (
          <Text style={[styles.notice, { color: palette.error }]}>{actionError}</Text>
        )}
      </SectionCard>

      <View style={styles.filterRow}>
        {(['all', 'active', 'ended'] as StatusFilter[]).map((value) => {
          const selected = statusFilter === value;
          return (
            <Button
              key={value}
              mode={selected ? 'contained' : 'outlined'}
              compact
              onPress={() => setStatusFilter(value)}
              style={[
                styles.filterBtn,
                {
                  backgroundColor: selected ? palette.primary : 'transparent',
                  borderColor: selected ? palette.primary : palette.border,
                },
              ]}
              labelStyle={{ color: selected ? palette.onPrimary : palette.textSecondary }}
            >
              {value === 'all' ? 'All' : value === 'active' ? 'Active' : 'Ended'}
            </Button>
          );
        })}
      </View>

      {sessions.meta !== null && (
        <Text style={[styles.metaLine, { color: palette.textMuted }]}>
          {sessions.meta.total} session{sessions.meta.total === 1 ? '' : 's'} · page{' '}
          {sessions.meta.page}/{Math.max(1, sessions.meta.totalPages)}
        </Text>
      )}
    </View>
  );

  const listEmpty = () => {
    if (sessions.loading) return <LoadingState message="Loading sessions…" />;
    if (sessions.error) return <ErrorState error={sessions.error} onRetry={sessions.refresh} />;
    return (
      <EmptyState
        icon="🗂️"
        title="No sessions yet"
        message="No monitoring session matches this filter. Start one above to scope the backend statistics."
      />
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Sessions' }} />
      <FlatList
        style={[styles.container, { backgroundColor: palette.background }]}
        contentContainerStyle={styles.content}
        data={sessions.items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <SessionRow session={item} />}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        refreshControl={
          <RefreshControl
            refreshing={sessions.refreshing}
            onRefresh={sessions.refresh}
            tintColor={palette.primary}
            colors={[palette.primary]}
          />
        }
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (sessions.hasMore && !sessions.loadingMore) void sessions.loadMore();
        }}
        ListFooterComponent={
          sessions.items.length === 0 ? null : (
            <View style={styles.footer}>
              {sessions.loadingMore && <ActivityIndicator color={palette.primary} />}
              {!sessions.hasMore && (
                <Text style={[styles.metaLine, { color: palette.textMuted }]}>
                  End of stored sessions.
                </Text>
              )}
            </View>
          )
        }
      />
    </>
  );
}

const STATUS_TONE: Record<SessionView['status'], Tone> = {
  active: 'good',
  ended: 'neutral',
};

function SessionRow({ session }: { session: SessionView }) {
  const { palette } = useAppTheme();
  const stats = session.statistics;

  return (
    <SectionCard style={styles.sessionCard}>
      <View style={styles.sessionHeader}>
        <StatusPill
          label={session.status === 'active' ? 'Active' : 'Ended'}
          tone={STATUS_TONE[session.status]}
        />
        <Text style={[styles.sessionId, { color: palette.textMuted }]} numberOfLines={1}>
          {session.id}
        </Text>
      </View>

      <InfoRow label="Started" value={formatDateTime(session.startedAt)} />
      <InfoRow label="Ended" value={formatDateTime(session.endedAt)} />
      <InfoRow label="Duration" value={formatDurationHuman(session.durationSeconds)} />
      <InfoRow
        label="Good posture"
        value={formatPercent(stats.goodPosturePercentage)}
        hint="Share of the session's monitored time"
      />
      <InfoRow label="Monitored" value={formatDurationHuman(stats.monitoredDurationSeconds)} />
      <InfoRow label="Measurements" value={String(stats.measurements)} />
      <InfoRow
        label="Average angle"
        value={stats.averageAngle === null ? '—' : formatDegrees(stats.averageAngle)}
      />
      <InfoRow label="Incorrect events" value={String(stats.incorrectPostureEvents)} />
      {session.notes !== null && <InfoRow label="Notes" value={session.notes} />}
      <Text style={[styles.sessionFootnote, { color: palette.textMuted }]}>
        {session.statisticsAreFinal
          ? 'Statistics are final (session closed).'
          : 'Statistics are still being computed while the session is active.'}
      </Text>
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  header: { gap: 14, marginBottom: 14 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12, flexWrap: 'wrap' },
  actionBtn: { borderRadius: 12 },
  notice: { fontSize: 12, lineHeight: 17, marginTop: 10 },
  filterRow: { flexDirection: 'row', gap: 8 },
  filterBtn: { borderRadius: 12 },
  metaLine: { fontSize: 11, marginTop: 4 },
  sessionCard: { marginBottom: 12 },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 6,
  },
  sessionId: { fontSize: 10, flexShrink: 1 },
  sessionFootnote: { fontSize: 11, lineHeight: 16, marginTop: 8 },
  footer: { alignItems: 'center', paddingVertical: 12, gap: 6 },
});
