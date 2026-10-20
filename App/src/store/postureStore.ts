import { create } from 'zustand';
import type { LivePostureMeasurement, PostureClass } from '../types/posture';
import { PostureClass as PostureClassEnum } from '../types/posture';

const CHART_BUFFER_SIZE = 120; // ~2 minutes at 1Hz

interface PostureStoreState {
  currentMeasurement: LivePostureMeasurement | null;
  /** Rolling buffer of recent measurements for the live chart. */
  chartBuffer: LivePostureMeasurement[];
  todayAlertCount: number;
  todayGoodPosturePercent: number | null;
  /** Whether the most recent measurement was simulated (dev-only). */
  isSimulated: boolean;

  setMeasurement: (m: LivePostureMeasurement, simulated?: boolean) => void;
  reset: () => void;
  setTodayAlertCount: (count: number) => void;
  setTodayGoodPosturePercent: (pct: number | null) => void;
}

export const usePostureStore = create<PostureStoreState>((set) => ({
  currentMeasurement: null,
  chartBuffer: [],
  todayAlertCount: 0,
  todayGoodPosturePercent: null,
  isSimulated: false,

  setMeasurement: (m, simulated = false) =>
    set((state) => {
      const chartBuffer = [...state.chartBuffer, m];
      if (chartBuffer.length > CHART_BUFFER_SIZE) {
        chartBuffer.splice(0, chartBuffer.length - CHART_BUFFER_SIZE);
      }
      const todayAlertCount = m.alert ? state.todayAlertCount + 1 : state.todayAlertCount;
      return {
        currentMeasurement: m,
        chartBuffer,
        todayAlertCount,
        isSimulated: simulated,
      };
    }),

  reset: () =>
    set({
      currentMeasurement: null,
      chartBuffer: [],
      todayAlertCount: 0,
      isSimulated: false,
    }),

  setTodayAlertCount: (todayAlertCount) => set({ todayAlertCount }),
  setTodayGoodPosturePercent: (todayGoodPosturePercent) =>
    set({ todayGoodPosturePercent }),
}));
