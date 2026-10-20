/**
 * DEVELOPMENT-ONLY posture simulator.
 *
 * This module exists ONLY to allow UI testing without physical hardware.
 * It is gated behind `__DEV__` and an explicit `simulatorEnabled` flag.
 *
 * CRITICAL: All data produced here is synthetic and MUST be labeled as
 * "Simulated" in the UI. It must never be merged into real device data streams
 * and is completely inactive in production builds.
 */
import { PostureClass } from '../../types/posture';
import type { LivePostureMeasurement } from '../../types/posture';
import { usePostureStore } from '../../store/postureStore';

const CLASSES: PostureClass[] = [
  PostureClass.GOOD_POSTURE,
  PostureClass.SLOUCHING,
  PostureClass.LEAN_LEFT,
  PostureClass.LEAN_RIGHT,
  PostureClass.HEAD_FORWARD,
  PostureClass.UNKNOWN,
];

let intervalId: ReturnType<typeof setInterval> | null = null;
let badEpisodeStart = 0;
let currentPosture = PostureClass.GOOD_POSTURE;

function generateMeasurement(): LivePostureMeasurement {
  // Rotate posture class every ~10 ticks for demo purposes
  const tick = Math.floor(Date.now() / 3000) % CLASSES.length;
  currentPosture = CLASSES[tick];

  const isPoor = currentPosture !== PostureClass.GOOD_POSTURE && currentPosture !== PostureClass.UNKNOWN;
  if (isPoor && badEpisodeStart === 0) {
    badEpisodeStart = Date.now();
  } else if (!isPoor) {
    badEpisodeStart = 0;
  }
  const badDuration = badEpisodeStart > 0 ? Date.now() - badEpisodeStart : 0;

  return {
    version: 1,
    posture: currentPosture,
    roll: currentPosture === PostureClass.LEAN_LEFT ? -12 : currentPosture === PostureClass.LEAN_RIGHT ? 12 : (Math.random() * 4 - 2),
    pitch: currentPosture === PostureClass.HEAD_FORWARD ? 18 : currentPosture === PostureClass.SLOUCHING ? -15 : (Math.random() * 3 - 1.5),
    confidence: 0.7 + Math.random() * 0.3,
    bad_duration: badDuration,
    battery: 75 + Math.floor(Math.random() * 5),
    alert: badDuration > 10000,
    timestamp: Date.now(),
  };
}

/**
 * Start the simulator. Feeds synthetic measurements into the posture store
 * with `simulated: true` so the UI labels them.
 */
export function startSimulator(): void {
  if (!__DEV__) return;
  if (intervalId !== null) return;

  const tick = () => {
    const m = generateMeasurement();
    usePostureStore.getState().setMeasurement(m, true);
  };
  tick();
  intervalId = setInterval(tick, 1000);
}

export function stopSimulator(): void {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
  badEpisodeStart = 0;
}

export function isSimulatorRunning(): boolean {
  return intervalId !== null;
}
