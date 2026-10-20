import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppSettings } from '../../types/settings';
import { DEFAULT_APP_SETTINGS } from '../../types/settings';

const SETTINGS_KEY = 'smartposture:settings';

/**
 * Persist and retrieve app settings from AsyncStorage.
 * On read failure, returns the default settings rather than throwing, since
 * storage should never crash the UI layer.
 */
export async function loadSettings(): Promise<AppSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_APP_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return mergeSettings(DEFAULT_APP_SETTINGS, parsed);
  } catch (err) {
    console.warn('[SettingsStorage] Failed to load settings:', err);
    return { ...DEFAULT_APP_SETTINGS };
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn('[SettingsStorage] Failed to save settings:', err);
    throw err;
  }
}

function mergeSettings(base: AppSettings, override: Partial<AppSettings>): AppSettings {
  return {
    ...base,
    ...override,
    alerts: {
      ...base.alerts,
      ...override.alerts,
    },
  };
}
