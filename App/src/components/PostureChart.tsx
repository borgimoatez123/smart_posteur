import React, { useMemo } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Card } from 'react-native-paper';
import Svg, { Polyline, Path, Line, Text as SvgText, Rect } from 'react-native-svg';
import type { LivePostureMeasurement } from '../types/posture';
import { useAppTheme } from '../theme/ThemeProvider';

interface Props {
  data: LivePostureMeasurement[];
  maxPoints?: number;
}

const CHART_WIDTH = 320;
const CHART_HEIGHT = 140;
const PADDING = 24;

/**
 * Scrolling line chart of recent roll and pitch angles.
 * Renders only real data from the posture store buffer. When empty, shows
 * a placeholder message rather than a flat zero line.
 */
export function PostureChart({ data, maxPoints = 60 }: Props) {
  const { palette } = useAppTheme();

  const points = useMemo(() => data.slice(-maxPoints), [data, maxPoints]);

  if (points.length < 2) {
    return (
      <Card style={[styles.card, { backgroundColor: palette.surface }]}>
        <Card.Content>
          <Text style={[styles.title, { color: palette.text }]}>Live Angles</Text>
          <View style={styles.placeholder}>
            <Text style={[styles.placeholderText, { color: palette.textMuted }]}>
              Waiting for posture data…
            </Text>
          </View>
        </Card.Content>
      </Card>
    );
  }

  const innerW = CHART_WIDTH - PADDING * 2;
  const innerH = CHART_HEIGHT - PADDING * 2;

  // Normalize roll/pitch to -90..90 range
  const normalize = (v: number) => Math.max(-90, Math.min(90, v));
  const yFor = (v: number) => PADDING + innerH / 2 - (normalize(v) / 90) * (innerH / 2);

  const rollPoints = points.map((p, i) => {
    const x = PADDING + (i / (points.length - 1)) * innerW;
    return `${x},${yFor(p.roll)}`;
  }).join(' ');

  const pitchPoints = points.map((p, i) => {
    const x = PADDING + (i / (points.length - 1)) * innerW;
    return `${x},${yFor(p.pitch)}`;
  }).join(' ');

  const midY = PADDING + innerH / 2;

  return (
    <Card style={[styles.card, { backgroundColor: palette.surface }]}>
      <Card.Content>
        <View style={styles.header}>
          <Text style={[styles.title, { color: palette.text }]}>Live Angles</Text>
          <View style={styles.legend}>
            <View style={[styles.legendDot, { backgroundColor: palette.teal }]} />
            <Text style={[styles.legendText, { color: palette.textSecondary }]}>Roll</Text>
            <View style={[styles.legendDot, { backgroundColor: palette.posture.warning }]} />
            <Text style={[styles.legendText, { color: palette.textSecondary }]}>Pitch</Text>
          </View>
        </View>
        <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
          {/* zero line */}
          <Line
            x1={PADDING}
            y1={midY}
            x2={CHART_WIDTH - PADDING}
            y2={midY}
            stroke={palette.border}
            strokeWidth={1}
            strokeDasharray="4 4"
          />
          <Polyline
            points={rollPoints}
            fill="none"
            stroke={palette.teal}
            strokeWidth={2}
          />
          <Polyline
            points={pitchPoints}
            fill="none"
            stroke={palette.posture.warning}
            strokeWidth={2}
          />
        </Svg>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    elevation: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
    marginRight: 4,
  },
  legendText: {
    fontSize: 11,
  },
  placeholder: {
    height: CHART_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 13,
  },
});
