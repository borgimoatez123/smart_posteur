import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import { ConnectionState } from '../types/device';
import { useAppTheme } from '../theme/ThemeProvider';

interface Props {
  state: ConnectionState;
}

const STATE_LABEL: Record<ConnectionState, string> = {
  [ConnectionState.Connected]: 'Connected',
  [ConnectionState.Connecting]: 'Connecting…',
  [ConnectionState.Disconnected]: 'Disconnected',
  [ConnectionState.Disconnecting]: 'Disconnecting…',
};

export function ConnectionStatus({ state }: Props) {
  const { palette } = useAppTheme();
  const isConnected = state === ConnectionState.Connected;
  const isConnecting = state === ConnectionState.Connecting;
  const color = isConnected ? palette.posture.good : isConnecting ? palette.posture.warning : palette.textMuted;

  return (
    <View style={[styles.container, { backgroundColor: palette.surfaceElevated, borderColor: palette.border }]}>
      {isConnecting ? (
        <ActivityIndicator size={14} color={color} />
      ) : (
        <View style={[styles.dot, { backgroundColor: color }]} />
      )}
      <Text style={[styles.label, { color: palette.text }]}>{STATE_LABEL[state]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
});
