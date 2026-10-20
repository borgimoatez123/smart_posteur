import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import { useAppTheme } from '../theme/ThemeProvider';

interface Props {
  message?: string;
}

export function LoadingState({ message = 'Loading…' }: Props) {
  const { palette } = useAppTheme();
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={palette.primary} />
      <Text style={[styles.message, { color: palette.textSecondary }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  message: {
    marginTop: 16,
    fontSize: 14,
  },
});
