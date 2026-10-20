import { create } from 'zustand';

export type CalibrationStatus =
  | 'idle'
  | 'calibrating'
  | 'success'
  | 'error'
  | 'timeout'
  | 'cancelled';

interface CalibrationStoreState {
  status: CalibrationStatus;
  /** Progress 0..100, only updated from device messages. */
  progress: number;
  referenceRoll: number | null;
  referencePitch: number | null;
  /** Epoch ms of the last successful calibration. */
  lastCalibratedAt: number | null;
  errorMessage: string | null;

  setStatus: (status: CalibrationStatus) => void;
  setProgress: (progress: number) => void;
  setResult: (roll: number | null, pitch: number | null, timestamp: number) => void;
  setError: (message: string | null) => void;
  reset: () => void;
}

export const useCalibrationStore = create<CalibrationStoreState>((set) => ({
  status: 'idle',
  progress: 0,
  referenceRoll: null,
  referencePitch: null,
  lastCalibratedAt: null,
  errorMessage: null,

  setStatus: (status) => set({ status }),
  setProgress: (progress) => set({ progress }),
  setResult: (referenceRoll, referencePitch, timestamp) =>
    set({
      referenceRoll,
      referencePitch,
      lastCalibratedAt: timestamp,
      status: 'success',
      progress: 100,
    }),
  setError: (errorMessage) => set({ errorMessage, status: 'error' }),
  reset: () =>
    set({
      status: 'idle',
      progress: 0,
      referenceRoll: null,
      referencePitch: null,
      errorMessage: null,
    }),
}));
