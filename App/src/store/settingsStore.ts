import { create } from 'zustand';
import type { AppSettings, AlertSettings, ThemeMode, MeasurementUnit } from '../types/settings';
import { DEFAULT_APP_SETTINGS } from '../types/settings';
import { loadSettings, saveSettings } from '../services/storage/SettingsStorage';

interface SettingsStoreState extends AppSettings {
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setOnboardingCompleted: (completed: boolean) => Promise<void>;
  setTheme: (theme: ThemeMode) => Promise<void>;
  setUnit: (unit: MeasurementUnit) => Promise<void>;
  setAlertSetting: <K extends keyof AlertSettings>(
    key: K,
    value: AlertSettings[K],
  ) => Promise<void>;
  setAutoReconnect: (enabled: boolean) => Promise<void>;
}

function persist(state: AppSettings): Promise<void> {
  return saveSettings(state);
}

export const useSettingsStore = create<SettingsStoreState>((set, get) => ({
  ...DEFAULT_APP_SETTINGS,
  hydrated: false,

  hydrate: async () => {
    const loaded = await loadSettings();
    set({ ...loaded, hydrated: true });
  },

  setOnboardingCompleted: async (onboardingCompleted) => {
    set({ onboardingCompleted });
    await persist(get());
  },

  setTheme: async (theme) => {
    set({ theme });
    await persist(get());
  },

  setUnit: async (unit) => {
    set({ unit });
    await persist(get());
  },

  setAlertSetting: async (key, value) => {
    set((state) => ({ alerts: { ...state.alerts, [key]: value } }));
    await persist(get());
  },

  setAutoReconnect: async (autoReconnect) => {
    set({ autoReconnect });
    await persist(get());
  },
}));
