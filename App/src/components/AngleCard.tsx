import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card } from 'react-native-paper';
import { useAppTheme } from '../theme/ThemeProvider';
import { formatAngle, formatBattery } from '../utils/angleUtils';

interface AngleCardProps {
  label: string;
  value: number | null;
  unit?: 'degrees' | 'radians';
  icon?: string;
}

/**
 * Displays a single angle (roll/pitch) value.
 * IMPORTANT: When value is null, renders "—" — never 0 — to distinguish
 * "no data" from a real zero measurement.
 */
export function AngleCard({ label, value, unit = 'degrees', icon }: AngleCardProps) {
  const { palette } = useAppTheme();
  const display = formatAngle(value, unit);

  return (
    <Card style={[styles.card, { backgroundColor: palette.surface }]}>
      <Card.Content style={styles.content}>
        <Text style={[styles.label, { color: palette.textMuted }]}>{label}</Text>
        <View style={styles.valueRow}>
          {icon && <Text style={[styles.icon, { color: palette.primary }]}>{icon}</Text>}
          <Text style={[styles.value, { color: palette.text }]}>{display}</Text>
        </View>
      </Card.Content>
    </Card>
  );
}

interface BatteryCardProps {
  battery: number | null;
}

export function BatteryCard({ battery }: BatteryCardProps) {
  const { palette } = useAppTheme();
  return (
    <Card style={[styles.card, { backgroundColor: palette.surface }]}>
      <Card.Content style={styles.content}>
        <Text style={[styles.label, { color: palette.textMuted }]}>Battery</Text>
        <View style={styles.valueRow}>
          <Text style={[styles.icon, { color: palette.primary }]}>🔋</Text>
          <Text style={[styles.value, { color: palette.text }]}>{formatBattery(battery)}</Text>
        </View>
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
    alignItems: 'center',
    paddingVertical: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  icon: {
    fontSize: 18,
    marginRight: 6,
  },
  value: {
    fontSize: 24,
    fontWeight: '700',
  },
});
