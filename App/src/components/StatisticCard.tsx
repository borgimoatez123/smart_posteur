import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card } from 'react-native-paper';
import { useAppTheme } from '../theme/ThemeProvider';

interface Props {
  label: string;
  value: string | number | null;
  unit?: string;
  hint?: string;
}

export function StatisticCard({ label, value, unit, hint }: Props) {
  const { palette } = useAppTheme();
  const displayValue = value === null || value === undefined ? '—' : String(value);

  return (
    <Card style={[styles.card, { backgroundColor: palette.surface }]}>
      <Card.Content style={styles.content}>
        <Text style={[styles.label, { color: palette.textMuted }]}>{label}</Text>
        <View style={styles.valueRow}>
          <Text style={[styles.value, { color: palette.text }]}>{displayValue}</Text>
          {unit && <Text style={[styles.unit, { color: palette.textSecondary }]}>{unit}</Text>}
        </View>
        {hint && <Text style={[styles.hint, { color: palette.textMuted }]}>{hint}</Text>}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 16,
    elevation: 1,
  },
  content: {
    paddingVertical: 12,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 6,
  },
  value: {
    fontSize: 26,
    fontWeight: '700',
  },
  unit: {
    fontSize: 14,
    marginLeft: 4,
  },
  hint: {
    fontSize: 11,
    marginTop: 4,
  },
});
