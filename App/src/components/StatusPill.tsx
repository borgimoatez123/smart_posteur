import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../theme/ThemeProvider';
import type { Tone } from '../utils/postureDisplay';

interface Props {
  label: string;
  tone: Tone;
  showDot?: boolean;
}

/** Small status pill used for device status, event severity and AI priority. */
export function StatusPill({ label, tone, showDot = true }: Props) {
  const { palette } = useAppTheme();
  const color = palette.posture[tone];

  return (
    <View style={[styles.pill, { backgroundColor: color + '22', borderColor: color }]}>
      {showDot && <View style={[styles.dot, { backgroundColor: color }]} />}
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  dot: { width: 7, height: 7, borderRadius: 4, marginRight: 6 },
  label: { fontSize: 12, fontWeight: '700' },
});
