import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from 'react-native-paper';
import type { ApiError } from '../api/client';
import { API_BASE_URL } from '../config/appConfig';
import { useAppTheme } from '../theme/ThemeProvider';

interface Props {
  error: ApiError | null;
  fallbackMessage?: string;
  onRetry?: () => void;
  /** Renders a compact inline banner instead of a full-screen state. */
  compact?: boolean;
}

/**
 * Readable failure state. Never exposes stack traces or secrets: only the
 * mapped, human readable API message plus optional connectivity guidance.
 */
export function ErrorState({ error, fallbackMessage, onRetry, compact = false }: Props) {
  const { palette } = useAppTheme();
  const isConnectivity = error?.isConnectivityError ?? false;

  const message = error?.message ?? fallbackMessage ?? 'Something went wrong.';

  return (
    <View
      style={[
        compact ? styles.compact : styles.container,
        { backgroundColor: palette.surface, borderColor: palette.error },
      ]}
    >
      <Text style={[styles.title, { color: palette.error }]}>
        {isConnectivity ? 'Backend unreachable' : 'Request failed'}
      </Text>
      <Text style={[styles.message, { color: palette.textSecondary }]}>{message}</Text>

      {isConnectivity && (
        <Text style={[styles.hint, { color: palette.textMuted }]}>
          Current backend: {API_BASE_URL}
          {'\n'}• Phone and computer must be on the same Wi-Fi network.
          {'\n'}• The backend must listen on a LAN interface (not only localhost).
          {'\n'}• Set EXPO_PUBLIC_API_URL to the computer's LAN IP (Android emulator: 10.0.2.2).
        </Text>
      )}

      {error?.code && error.code !== 'NETWORK_ERROR' && error.code !== 'TIMEOUT' && (
        <Text style={[styles.code, { color: palette.textMuted }]}>Code: {error.code}</Text>
      )}

      {onRetry && (
        <Button
          mode="contained"
          onPress={onRetry}
          style={[styles.retry, { backgroundColor: palette.primary }]}
          labelStyle={{ color: palette.onPrimary }}
        >
          Retry
        </Button>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
  },
  compact: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  title: { fontSize: 16, fontWeight: '700', marginBottom: 6, textAlign: 'center' },
  message: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
  hint: { fontSize: 11, lineHeight: 17, marginTop: 10 },
  code: { fontSize: 11, marginTop: 8 },
  retry: { marginTop: 16, borderRadius: 12 },
});
