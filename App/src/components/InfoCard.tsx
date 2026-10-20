import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useAppTheme } from '../theme/ThemeProvider';
import type { Tone } from '../utils/postureDisplay';

interface SectionCardProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
}

/** Rounded surface container used by every backend-driven screen. */
export function SectionCard({ title, subtitle, children, style }: SectionCardProps) {
  const { palette } = useAppTheme();
  return (
    <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }, style]}>
      {title !== undefined && (
        <Text style={[styles.cardTitle, { color: palette.textMuted }]}>{title.toUpperCase()}</Text>
      )}
      {subtitle !== undefined && (
        <Text style={[styles.cardSubtitle, { color: palette.textSecondary }]}>{subtitle}</Text>
      )}
      {children}
    </View>
  );
}

interface InfoRowProps {
  label: string;
  value: string;
  /** Colours the value using a semantic tone (e.g. a device status). */
  tone?: Tone;
  hint?: string;
}

/** Label / value line. Values are pre-formatted; missing values render as "—". */
export function InfoRow({ label, value, tone, hint }: InfoRowProps) {
  const { palette } = useAppTheme();
  const valueColor = tone ? palette.posture[tone] : palette.text;

  return (
    <View style={styles.row}>
      <View style={styles.rowTexts}>
        <Text style={[styles.rowLabel, { color: palette.textSecondary }]}>{label}</Text>
        {hint !== undefined && (
          <Text style={[styles.rowHint, { color: palette.textMuted }]}>{hint}</Text>
        )}
      </View>
      <Text style={[styles.rowValue, { color: valueColor }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  cardTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 10 },
  cardSubtitle: { fontSize: 12, lineHeight: 17, marginBottom: 10 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 7,
  },
  rowTexts: { flex: 1, marginRight: 12 },
  rowLabel: { fontSize: 14 },
  rowHint: { fontSize: 11, marginTop: 2, lineHeight: 15 },
  rowValue: { fontSize: 14, fontWeight: '700', maxWidth: '55%', textAlign: 'right' },
});
