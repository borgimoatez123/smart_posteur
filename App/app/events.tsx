import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack } from 'expo-router';
import { Chip } from 'react-native-paper';
import { useAppTheme } from '../src/theme/ThemeProvider';
import { useEvents } from '../src/hooks/useEvents';
import type { EventSeverity, EventType, EventView } from '../src/api/types';
import { ErrorState } from '../src/components/ErrorState';
import { LoadingState } from '../src/components/LoadingState';
import { EmptyState } from '../src/components/EmptyState';
import { StatusPill } from '../src/components/StatusPill';
import { SectionCard } from '../src/components/InfoCard';
import {
  EVENT_SEVERITY_LABEL,
  EVENT_SEVERITY_TONE,
  EVENT_TYPE_DESCRIPTION,
  EVENT_TYPE_LABEL,
} from '../src/utils/postureDisplay';
import { formatDateTime, formatRelative } from '../src/utils/format';

const EVENT_TYPES: EventType[] = [
  'POSTURE_INCORRECT',
  'VIBRATION_ALERT',
  'SENSOR_ERROR',
  'LOW_BATTERY',
  'DEVICE_DISCONNECTED',
  'DEVICE_RECONNECTED',
];

const SEVERITIES: EventSeverity[] = ['info', 'warning', 'critical'];

/** Renders the stored metadata as readable `key: value` lines. */
function metadataEntries(metadata: Record<string, unknown>): Array<[string, string]> {
  return Object.entries(metadata).map(([key, value]) => {
    let rendered: string;
    if (value === null || value === undefined) rendered = '—';
    else if (typeof value === 'string') rendered = value;
    else if (typeof value === 'number' || typeof value === 'boolean') rendered = String(value);
    else rendered = JSON.stringify(value);
    return [key, rendered];
  });
}

/**
 * Screen F — Events and alerts.
 *
 * Measurements, posture alerts (the wearable flagging incorrect posture) and
 * vibration events are kept distinct: the type label and its description tell
 * the user exactly what happened, and nothing is inferred from posture labels.
 */
export default function EventsScreen() {
  const { palette } = useAppTheme();
  const [type, setType] = useState<EventType | null>(null);
  const [severity, setSeverity] = useState<EventSeverity | null>(null);

  const filters = useMemo(
    () => ({ type: type ?? undefined, severity: severity ?? undefined }),
    [type, severity],
  );
  const events = useEvents(filters);

  const listHeader = (
    <View style={styles.header}>
      <Text style={[styles.filterTitle, { color: palette.textMuted }]}>EVENT TYPE</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        <Chip selected={type === null} onPress={() => setType(null)}>
          All
        </Chip>
        {EVENT_TYPES.map((value) => (
          <Chip
            key={value}
            selected={type === value}
            onPress={() => setType(type === value ? null : value)}
          >
            {EVENT_TYPE_LABEL[value]}
          </Chip>
        ))}
      </ScrollView>

      <Text style={[styles.filterTitle, { color: palette.textMuted }]}>SEVERITY</Text>
      <View style={styles.chipRow}>
        <Chip selected={severity === null} onPress={() => setSeverity(null)}>
          All
        </Chip>
        {SEVERITIES.map((value) => (
          <Chip
            key={value}
            selected={severity === value}
            onPress={() => setSeverity(severity === value ? null : value)}
          >
            {EVENT_SEVERITY_LABEL[value]}
          </Chip>
        ))}
      </View>

      {events.meta !== null && (
        <Text style={[styles.metaLine, { color: palette.textMuted }]}>
          {events.meta.total} event{events.meta.total === 1 ? '' : 's'} · page{' '}
          {events.meta.page}/{Math.max(1, events.meta.totalPages)}
        </Text>
      )}
    </View>
  );

  const listEmpty = () => {
    if (events.loading) return <LoadingState message="Loading events…" />;
    if (events.error) return <ErrorState error={events.error} onRetry={events.refresh} />;
    return (
      <EmptyState
        icon="🔔"
        title="No events"
        message="No stored event matches these filters. Events are created by the backend from wearable telemetry."
      />
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Events' }} />
      <FlatList
        style={[styles.container, { backgroundColor: palette.background }]}
        contentContainerStyle={styles.content}
        data={events.items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <EventRow event={item} />}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        refreshControl={
          <RefreshControl
            refreshing={events.refreshing}
            onRefresh={events.refresh}
            tintColor={palette.primary}
            colors={[palette.primary]}
          />
        }
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (events.hasMore && !events.loadingMore) void events.loadMore();
        }}
        ListFooterComponent={
          events.items.length === 0 ? null : (
            <View style={styles.footer}>
              {events.loadingMore && <ActivityIndicator color={palette.primary} />}
              {!events.hasMore && (
                <Text style={[styles.metaLine, { color: palette.textMuted }]}>
                  End of stored events.
                </Text>
              )}
            </View>
          )
        }
      />
    </>
  );
}

function EventRow({ event }: { event: EventView }) {
  const { palette } = useAppTheme();
  const entries = metadataEntries(event.metadata);

  return (
    <SectionCard style={styles.eventCard}>
      <View style={styles.eventHeader}>
        <Text style={[styles.eventTitle, { color: palette.text }]}>
          {EVENT_TYPE_LABEL[event.type]}
        </Text>
        <StatusPill
          label={EVENT_SEVERITY_LABEL[event.severity]}
          tone={EVENT_SEVERITY_TONE[event.severity]}
        />
      </View>

      <Text style={[styles.eventDescription, { color: palette.textSecondary }]}>
        {EVENT_TYPE_DESCRIPTION[event.type]}
      </Text>

      <Text style={[styles.eventTime, { color: palette.textMuted }]}>
        {formatRelative(event.timestamp)} · {formatDateTime(event.timestamp)}
      </Text>

      <Text style={[styles.eventMeta, { color: palette.textMuted }]}>
        Device {event.deviceId}
        {event.sessionId ? ` · session ${event.sessionId}` : ' · no session'}
      </Text>

      {entries.length > 0 && (
        <View style={[styles.metadataBox, { borderColor: palette.border, backgroundColor: palette.surfaceElevated }]}>
          {entries.map(([key, value]) => (
            <Text key={key} style={[styles.metadataLine, { color: palette.textSecondary }]}>
              <Text style={{ color: palette.textMuted }}>{key}: </Text>
              {value}
            </Text>
          ))}
        </View>
      )}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  header: { marginBottom: 12, gap: 6 },
  filterTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginTop: 6 },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  metaLine: { fontSize: 11, marginTop: 6 },
  eventCard: { marginBottom: 12 },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 6,
  },
  eventTitle: { fontSize: 15, fontWeight: '700', flexShrink: 1 },
  eventDescription: { fontSize: 12, lineHeight: 17 },
  eventTime: { fontSize: 11, marginTop: 8 },
  eventMeta: { fontSize: 11, marginTop: 2 },
  metadataBox: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    gap: 3,
  },
  metadataLine: { fontSize: 11, lineHeight: 16 },
  footer: { alignItems: 'center', paddingVertical: 12, gap: 6 },
});
