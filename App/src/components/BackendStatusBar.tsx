import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { IconButton } from 'react-native-paper';
import type { ApiError } from '../api/client';
import type { HealthResponse } from '../api/types';
import { API_BASE_URL } from '../config/appConfig';
import { useAppTheme } from '../theme/ThemeProvider';
import { formatTime } from '../utils/format';

interface Props {
  health: HealthResponse | null;
  error: ApiError | null;
  lastUpdatedAt: number | null;
  onRetry: () => void;
}

/**
 * Backend + MongoDB connectivity strip.
 *
 * Keeps three states visually distinct:
 *  - backend unreachable        → request error
 *  - backend up, DB degraded    → 200 with `status: "degraded"`
 *  - backend and DB healthy
 */
export function BackendStatusBar({ health, error, lastUpdatedAt, onRetry }: Props) {
  const { palette } = useAppTheme();

  let color = palette.textMuted;
  let title = 'Checking backend…';
  let detail = API_BASE_URL;

  if (error && !health) {
    color = palette.error;
    title = 'Backend unreachable';
    detail = error.message;
  } else if (health) {
    const databaseUp = health.status === 'ok' && health.database === 'connected';
    color = databaseUp ? palette.posture.good : palette.posture.warning;
    title = databaseUp ? 'Backend online · MongoDB connected' : 'Backend online · MongoDB unavailable';
    detail = databaseUp
      ? `${API_BASE_URL} · checked ${formatTime(health.timestamp)}`
      : `${health.databaseError ?? 'Database is not connected'} · ${API_BASE_URL}`;
  }

  return (
    <View style={[styles.container, { backgroundColor: palette.surface, borderColor: color }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <View style={styles.texts}>
        <Text style={[styles.title, { color }]}>{title}</Text>
        <Text style={[styles.detail, { color: palette.textSecondary }]} numberOfLines={2}>
          {detail}
        </Text>
        {lastUpdatedAt !== null && (
          <Text style={[styles.detail, { color: palette.textMuted }]}>
            Last successful request: {formatTime(new Date(lastUpdatedAt).toISOString())}
          </Text>
        )}
      </View>
      <IconButton
        icon="refresh"
        size={20}
        iconColor={palette.textSecondary}
        onPress={onRetry}
        accessibilityLabel="Retry backend check"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
  },
  dot: { width: 9, height: 9, borderRadius: 5, marginRight: 10 },
  texts: { flex: 1 },
  title: { fontSize: 13, fontWeight: '700' },
  detail: { fontSize: 11, marginTop: 2, lineHeight: 15 },
});
