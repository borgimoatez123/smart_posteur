import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card, useTheme } from 'react-native-paper';
import { PostureClass, POSTURE_COLOR_MAP } from '../types/posture';
import type { PostureClassColor } from '../types/posture';
import { useAppTheme } from '../theme/ThemeProvider';
import { formatDuration } from '../utils/angleUtils';

interface Props {
  posture: PostureClass | null;
  badDurationMs: number | null;
  alert: boolean;
}

const POSTURE_LABEL: Record<PostureClass, string> = {
  [PostureClass.GOOD_POSTURE]: 'Good Posture',
  [PostureClass.SLOUCHING]: 'Slouching',
  [PostureClass.LEAN_LEFT]: 'Leaning Left',
  [PostureClass.LEAN_RIGHT]: 'Leaning Right',
  [PostureClass.HEAD_FORWARD]: 'Head Forward',
  [PostureClass.UNKNOWN]: 'Unknown',
};

const POSTURE_ICON: Record<PostureClass, string> = {
  [PostureClass.GOOD_POSTURE]: 'check-circle',
  [PostureClass.SLOUCHING]: 'alert-circle',
  [PostureClass.LEAN_LEFT]: 'arrow-left-bold',
  [PostureClass.LEAN_RIGHT]: 'arrow-right-bold',
  [PostureClass.HEAD_FORWARD]: 'arrow-up-bold',
  [PostureClass.UNKNOWN]: 'help-circle',
};

const postureColorHex = (
  color: PostureClassColor,
  palette: ReturnType<typeof useAppTheme>['palette'],
): string => palette.posture[color];

export function PostureStatusCard({ posture, badDurationMs, alert }: Props) {
  const { palette } = useAppTheme();
  const paperTheme = useTheme();

  if (!posture) {
    return (
      <Card style={[styles.card, { backgroundColor: palette.surface }]}>
        <Card.Content style={styles.content}>
          <Text style={[styles.label, { color: palette.textMuted }]}>No posture data</Text>
          <Text style={[styles.sub, { color: palette.textMuted }]}>
            Connect your device to see live posture.
          </Text>
        </Card.Content>
      </Card>
    );
  }

  const colorKey = POSTURE_COLOR_MAP[posture];
  const accent = postureColorHex(colorKey, palette);

  return (
    <Card style={[styles.card, { backgroundColor: palette.surface, borderLeftColor: accent, borderLeftWidth: 6 }]}>
      <Card.Content style={styles.content}>
        <View style={styles.headerRow}>
          <View style={[styles.iconCircle, { backgroundColor: accent + '22' }]}>
            <Text style={[styles.iconText, { color: accent }]}>{POSTURE_ICON[posture] === 'check-circle' ? '✓' : POSTURE_ICON[posture] === 'alert-circle' ? '!' : '•'}</Text>
          </View>
          <View style={styles.textBlock}>
            <Text style={[styles.label, { color: palette.text }]}>{POSTURE_LABEL[posture]}</Text>
            {badDurationMs !== null && badDurationMs > 0 && (
              <Text style={[styles.sub, { color: palette.textSecondary }]}>
                Poor posture for {formatDuration(badDurationMs)}
              </Text>
            )}
          </View>
          {alert && (
            <View style={[styles.alertBadge, { backgroundColor: palette.posture.danger }]}>
              <Text style={styles.alertText}>ALERT</Text>
            </View>
          )}
        </View>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    elevation: 2,
  },
  content: {
    paddingVertical: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  iconText: {
    fontSize: 22,
    fontWeight: '700',
  },
  textBlock: {
    flex: 1,
  },
  label: {
    fontSize: 20,
    fontWeight: '700',
  },
  sub: {
    fontSize: 13,
    marginTop: 2,
  },
  alertBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  alertText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 11,
  },
});
