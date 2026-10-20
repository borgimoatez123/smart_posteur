import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Button, ProgressBar } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useCalibration } from '../src/hooks/useCalibration';
import { useAppTheme } from '../src/theme/ThemeProvider';
import { formatAngle, formatTime } from '../src/utils/angleUtils';
import type { CalibrationStatus } from '../src/store/calibrationStore';

export default function CalibrationScreen() {
  const router = useRouter();
  const { palette } = useAppTheme();
  const {
    status,
    progress,
    referenceRoll,
    referencePitch,
    lastCalibratedAt,
    errorMessage,
    startCalibration,
    cancelCalibration,
    recalibrate,
    reset,
  } = useCalibration();

  return (
    <ScrollView style={[styles.container, { backgroundColor: palette.background }]} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: palette.text }]}>Sensor Calibration</Text>
      <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
        Calibration is performed by your SmartPosture wearable. The app sends a
        command and waits for the device to confirm.
      </Text>

      {lastCalibratedAt && (
        <View style={[styles.lastCalCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Text style={[styles.lastCalLabel, { color: palette.textMuted }]}>Last calibrated</Text>
          <Text style={[styles.lastCalValue, { color: palette.text }]}>{formatTime(lastCalibratedAt)}</Text>
          {referenceRoll !== null && referencePitch !== null && (
            <Text style={[styles.lastCalRef, { color: palette.textSecondary }]}>
              Reference: Roll {formatAngle(referenceRoll)} / Pitch {formatAngle(referencePitch)}
            </Text>
          )}
        </View>
      )}

      <View style={[styles.stepsCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <Step n={1} text="Wear the sensor on your upper back, centered along your spine." palette={palette} done={status !== 'idle'} />
        <Step n={2} text="Sit in your correct, neutral posture." palette={palette} done={status !== 'idle'} />
        <Step n={3} text="Press Start Calibration and remain still." palette={palette} done={status === 'calibrating' || status === 'success'} />
        <Step n={4} text="Wait for the device to confirm calibration." palette={palette} done={status === 'success'} />
      </View>

      {status === 'calibrating' && (
        <View style={styles.progressWrap}>
          <ProgressBar progress={progress / 100} color={palette.primary} style={styles.progressBar} />
          <Text style={[styles.progressText, { color: palette.textSecondary }]}>
            Calibrating… keep still.
          </Text>
        </View>
      )}

      {status === 'success' && (
        <View style={[styles.resultCard, { backgroundColor: palette.posture.good + '22', borderColor: palette.posture.good }]}>
          <Text style={[styles.resultText, { color: palette.posture.good }]}>✓ Calibration complete</Text>
          {referenceRoll !== null && (
            <Text style={[styles.resultDetail, { color: palette.textSecondary }]}>
              Reference roll: {formatAngle(referenceRoll)}
            </Text>
          )}
          {referencePitch !== null && (
            <Text style={[styles.resultDetail, { color: palette.textSecondary }]}>
              Reference pitch: {formatAngle(referencePitch)}
            </Text>
          )}
        </View>
      )}

      {(status === 'error' || status === 'timeout' || status === 'cancelled') && (
        <View style={[styles.resultCard, { backgroundColor: palette.posture.danger + '22', borderColor: palette.posture.danger }]}>
          <Text style={[styles.resultText, { color: palette.posture.danger }]}>
            {status === 'timeout' ? '⏱ Calibration timed out' : status === 'cancelled' ? '✕ Calibration cancelled' : '✕ Calibration failed'}
          </Text>
          {errorMessage && (
            <Text style={[styles.resultDetail, { color: palette.textSecondary }]}>{errorMessage}</Text>
          )}
        </View>
      )}

      <View style={styles.actions}>
        {(status === 'idle' || status === 'cancelled' || status === 'error' || status === 'timeout') && (
          <Button
            mode="contained"
            onPress={startCalibration}
            style={[styles.btn, { backgroundColor: palette.primary }]}
            labelStyle={{ color: palette.onPrimary }}
          >
            {lastCalibratedAt ? 'Recalibrate' : 'Start Calibration'}
          </Button>
        )}

        {status === 'calibrating' && (
          <Button
            mode="outlined"
            onPress={cancelCalibration}
            style={[styles.btn, { borderColor: palette.posture.danger }]}
            textColor={palette.posture.danger}
          >
            Cancel
          </Button>
        )}

        {status === 'success' && (
          <>
            <Button
              mode="contained"
              onPress={recalibrate}
              style={[styles.btn, { backgroundColor: palette.primary }]}
              labelStyle={{ color: palette.onPrimary }}
            >
              Recalibrate
            </Button>
            <Button mode="text" onPress={() => router.back()} textColor={palette.textMuted}>
              Done
            </Button>
          </>
        )}

        {(status === 'error' || status === 'timeout') && (
          <Button mode="text" onPress={reset} textColor={palette.textMuted}>
            Reset
          </Button>
        )}
      </View>

      <Text style={[styles.disclaimer, { color: palette.textMuted }]}>
        The app does not calibrate the sensor itself. Calibration is executed by
        the ESP32 firmware; success is confirmed only when the device responds.
      </Text>
    </ScrollView>
  );
}

function Step({ n, text, palette, done }: { n: number; text: string; palette: any; done: boolean }) {
  return (
    <View style={styles.step}>
      <View style={[styles.stepNum, { backgroundColor: done ? palette.posture.good : palette.surfaceElevated, borderColor: palette.border }]}>
        <Text style={[styles.stepNumText, { color: done ? '#fff' : palette.text }]}>{done ? '✓' : n}</Text>
      </View>
      <Text style={[styles.stepText, { color: palette.textSecondary }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '800' },
  subtitle: { fontSize: 14, lineHeight: 20 },
  lastCalCard: { padding: 14, borderRadius: 14, borderWidth: 1 },
  lastCalLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  lastCalValue: { fontSize: 16, fontWeight: '600', marginTop: 2 },
  lastCalRef: { fontSize: 12, marginTop: 2 },
  stepsCard: { padding: 16, borderRadius: 14, borderWidth: 1, gap: 12 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepNum: {
    width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  stepNumText: { fontSize: 14, fontWeight: '700' },
  stepText: { flex: 1, fontSize: 14 },
  progressWrap: { gap: 8 },
  progressBar: { height: 8, borderRadius: 4 },
  progressText: { fontSize: 13, textAlign: 'center' },
  resultCard: { padding: 16, borderRadius: 14, borderWidth: 1, alignItems: 'center' },
  resultText: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  resultDetail: { fontSize: 13 },
  actions: { gap: 12, marginTop: 8 },
  btn: { borderRadius: 12 },
  disclaimer: { fontSize: 11, lineHeight: 16, marginTop: 8 },
});
