import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Chip } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../../src/theme/ThemeProvider';
import { usePostureHistory } from '../../src/hooks/usePostureHistory';
import type { HistoryRecord, PostureLabel, SortOrder } from '../../src/api/types';
import { ErrorState } from '../../src/components/ErrorState';
import { LoadingState } from '../../src/components/LoadingState';
import { EmptyState } from '../../src/components/EmptyState';
import { PostureBadge } from '../../src/components/PostureBadge';
import {
  POSTURE_SHORT_LABEL,
  getPostureDisplayLabel,
  parsePostureLabel,
} from '../../src/utils/postureDisplay';
import { formatDateTime, formatDegrees, formatRelative } from '../../src/utils/format';
import { PostureClass } from '../../src/types/posture';

const POSTURE_FILTERS: { value: PostureLabel | null; label: string }[] = [
  { value: null, label: 'All' },
  { value: PostureClass.GOOD_POSTURE, label: POSTURE_SHORT_LABEL[PostureClass.GOOD_POSTURE] },
  { value: PostureClass.SLOUCHING, label: POSTURE_SHORT_LABEL[PostureClass.SLOUCHING] },
  { value: PostureClass.LEAN_LEFT, label: POSTURE_SHORT_LABEL[PostureClass.LEAN_LEFT] },
  { value: PostureClass.LEAN_RIGHT, label: POSTURE_SHORT_LABEL[PostureClass.LEAN_RIGHT] },
  { value: PostureClass.HEAD_FORWARD, label: POSTURE_SHORT_LABEL[PostureClass.HEAD_FORWARD] },
  { value: PostureClass.UNKNOWN, label: POSTURE_SHORT_LABEL[PostureClass.UNKNOWN] },
];

/**
 * Screen D — History.
 *
 * Reads the paginated telemetry stored by the backend (`GET /api/v1/history`).
 * Nothing is kept locally, so the list always matches the server.
 */
export default function HistoryScreen() {
  const { palette } = useAppTheme();
  const router = useRouter();

  const [posture, setPosture] = useState<PostureLabel | null>(null);
  const [alertsOnly, setAlertsOnly] = useState(false);
  const [sort, setSort] = useState<SortOrder>('desc');

  const filters = useMemo(
    () => ({ posture: posture ?? undefined, alert: alertsOnly ? true : undefined, sort }),
    [posture, alertsOnly, sort],
  );

  const history = usePostureHistory(filters);

  const renderItem = useCallback(
    ({ item }: { item: HistoryRecord }) => (
      <MeasurementRow record={item} onPress={() => router.push(`/telemetry/${item.id}`)} />
    ),
    [router],
  );

  const keyExtractor = useCallback((item: HistoryRecord) => item.id, []);

  const listEmpty = useCallback(() => {
    if (history.loading) return <LoadingState message="Loading history…" />;
    if (history.error) return <ErrorState error={history.error} onRetry={history.refresh} />;
    return (
      <EmptyState
        icon="🗂"
        title="No measurements"
        message={
          posture === null && !alertsOnly
            ? 'The backend has not stored any measurement for this device yet.'
            : 'No stored measurement matches the selected filters.'
        }
      />
    );
  }, [history, posture, alertsOnly]);

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <View style={[styles.filters, { borderBottomColor: palette.border }]}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={POSTURE_FILTERS}
          keyExtractor={(item) => item.label}
          contentContainerStyle={styles.chipRow}
          renderItem={({ item }) => (
            <Chip
              selected={posture === item.value}
              showSelectedCheck={false}
              onPress={() => setPosture(item.value)}
              style={[styles.chip, { backgroundColor: palette.surface }]}
              textStyle={{ color: palette.text, fontSize: 12 }}
            >
              {item.label}
            </Chip>
          )}
        />
        <View style={styles.chipRow}>
          <Chip
            selected={alertsOnly}
            showSelectedCheck={false}
            icon="alert-circle-outline"
            onPress={() => setAlertsOnly((value) => !value)}
            style={[styles.chip, { backgroundColor: palette.surface }]}
            textStyle={{ color: palette.text, fontSize: 12 }}
          >
            Alerts only
          </Chip>
          <Chip
            selected={sort === 'asc'}
            showSelectedCheck={false}
            icon="sort-clock-ascending-outline"
            onPress={() => setSort((value) => (value === 'desc' ? 'asc' : 'desc'))}
            style={[styles.chip, { backgroundColor: palette.surface }]}
            textStyle={{ color: palette.text, fontSize: 12 }}
          >
            {sort === 'desc' ? 'Newest first' : 'Oldest first'}
          </Chip>
        </View>
        {history.meta !== null && (
          <Text style={[styles.meta, { color: palette.textMuted }]}>
            {history.meta.total} record{history.meta.total === 1 ? '' : 's'} on the server · page{' '}
            {history.meta.page}/{Math.max(1, history.meta.totalPages)}
          </Text>
        )}
      </View>

      {history.error !== null && history.items.length > 0 && (
        <View style={styles.inlineError}>
          <ErrorState error={history.error} onRetry={history.refresh} compact />
        </View>
      )}

      <FlatList
        data={history.items}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListEmptyComponent={listEmpty}
        contentContainerStyle={history.items.length === 0 ? styles.emptyContent : styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={history.refreshing}
            onRefresh={history.refresh}
            tintColor={palette.primary}
            colors={[palette.primary]}
          />
        }
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          void history.loadMore();
        }}
        ListFooterComponent={
          <View style={styles.footer}>
            {history.loadingMore && <ActivityIndicator color={palette.primary} />}
            {!history.hasMore && history.items.length > 0 && (
              <Text style={[styles.meta, { color: palette.textMuted }]}>
                End of stored history.
              </Text>
            )}
          </View>
        }
      />
    </View>
  );
}

function MeasurementRow({ record, onPress }: { record: HistoryRecord; onPress: () => void }) {
  const { palette } = useAppTheme();
  const postureValue = parsePostureLabel(record.posture.label);

  return (
    <View
      style={[styles.row, { backgroundColor: palette.surface, borderColor: palette.border }]}
    >
      <View style={styles.rowMain}>
        <View style={styles.rowHeader}>
          <PostureBadge
            posture={postureValue}
            size="sm"
            short
            emptyLabel={getPostureDisplayLabel(record.posture.label)}
          />
          {record.alert && (
            <Text style={[styles.alertTag, { color: palette.posture.warning }]}>ALERT</Text>
          )}
          {record.sensorError && (
            <Text style={[styles.alertTag, { color: palette.posture.danger }]}>SENSOR</Text>
          )}
        </View>
        <Text style={[styles.rowTime, { color: palette.textSecondary }]}>
          {formatRelative(record.timestamp)} · {formatDateTime(record.timestamp)}
        </Text>
        <Text style={[styles.rowMeta, { color: palette.textMuted }]}>
          Angle {formatDegrees(record.posture.angle)}
          {record.posture.confidence === null
            ? ''
            : ` · confidence ${(record.posture.confidence * 100).toFixed(0)}%`}
          {record.battery === null ? '' : ` · battery ${Math.round(record.battery)}%`}
        </Text>
      </View>
      <Chip
        compact
        icon="chevron-right"
        onPress={onPress}
        style={[styles.openChip, { backgroundColor: palette.surfaceElevated }]}
        textStyle={{ color: palette.text, fontSize: 11 }}
      >
        Details
      </Chip>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  filters: { paddingTop: 12, paddingBottom: 6, borderBottomWidth: 1 },
  chipRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  chip: { borderRadius: 10, height: 32 },
  meta: { fontSize: 11, paddingHorizontal: 16, paddingBottom: 6 },
  inlineError: { paddingHorizontal: 16, paddingTop: 12 },
  listContent: { padding: 16, gap: 10, paddingBottom: 40 },
  emptyContent: { flexGrow: 1 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, borderWidth: 1 },
  rowMain: { flex: 1, marginRight: 10 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  alertTag: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  rowTime: { fontSize: 12, marginTop: 6 },
  rowMeta: { fontSize: 11, marginTop: 3 },
  openChip: { borderRadius: 10 },
  footer: { paddingVertical: 18, alignItems: 'center' },
});
