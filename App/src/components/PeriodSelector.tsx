import React from 'react';
import { StyleSheet } from 'react-native';
import { SegmentedButtons } from 'react-native-paper';
import type { DashboardPeriod } from '../api/types';

interface Props {
  value: DashboardPeriod;
  onChange: (period: DashboardPeriod) => void;
  style?: object;
}

/** Day / Week / Month selector shared by the dashboard and analytics screens. */
export function PeriodSelector({ value, onChange, style }: Props) {
  return (
    <SegmentedButtons
      value={value}
      onValueChange={(next) => onChange(next as DashboardPeriod)}
      buttons={[
        { value: 'day', label: 'Day' },
        { value: 'week', label: 'Week' },
        { value: 'month', label: 'Month' },
      ]}
      style={[styles.segmented, style]}
      density="small"
    />
  );
}

const styles = StyleSheet.create({
  segmented: { marginBottom: 2 },
});
