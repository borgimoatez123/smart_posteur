import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PostureClass } from '../types/posture';
import { useAppTheme } from '../theme/ThemeProvider';
import { POSTURE_LABEL, POSTURE_SHORT_LABEL, POSTURE_TONE } from '../utils/postureDisplay';

interface Props {
  posture: PostureClass | null;
  size?: 'sm' | 'md' | 'lg';
  /** Use the condensed label (e.g. "Slouch") instead of the full label. */
  short?: boolean;
  /** Shown when no posture is available. */
  emptyLabel?: string;
}

/**
 * Renders a posture classification using a human readable label while the raw
 * backend value (`GOOD_POSTURE`, `UNKNOWN`, …) stays untouched internally.
 */
export function PostureBadge({ posture, size = 'md', short = false, emptyLabel = 'No data' }: Props) {
  const { palette } = useAppTheme();

  if (!posture) {
    return (
      <View style={[styles.pill, styles[size], { backgroundColor: palette.surfaceElevated, borderColor: palette.border }]}>
        <Text style={[styles.label, labelStyle[size], { color: palette.textMuted }]}>{emptyLabel}</Text>
      </View>
    );
  }

  const tone = POSTURE_TONE[posture];
  const color = palette.posture[tone];
  const label = short ? POSTURE_SHORT_LABEL[posture] : POSTURE_LABEL[posture];

  return (
    <View style={[styles.pill, styles[size], { backgroundColor: color + '22', borderColor: color }]}>
      <View style={[styles.dot, dotStyle[size], { backgroundColor: color }]} />
      <Text style={[styles.label, labelStyle[size], { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 14,
    borderWidth: 1,
  },
  sm: { paddingHorizontal: 8, paddingVertical: 2 },
  md: { paddingHorizontal: 10, paddingVertical: 4 },
  lg: { paddingHorizontal: 14, paddingVertical: 8 },
  dot: { borderRadius: 6, marginRight: 6 },
  label: { fontWeight: '700' },
});

const dotStyle = StyleSheet.create({
  sm: { width: 6, height: 6 },
  md: { width: 8, height: 8 },
  lg: { width: 10, height: 10 },
});

const labelStyle = StyleSheet.create({
  sm: { fontSize: 11 },
  md: { fontSize: 13 },
  lg: { fontSize: 18 },
});
