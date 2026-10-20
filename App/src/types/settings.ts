export type ThemeMode = 'light' | 'dark';
export type MeasurementUnit = 'degrees' | 'radians';

/** Alert/notification settings. Persisted locally; sent to firmware when supported. */
export interface AlertSettings {
  /** Poor-posture persistence delay before a vibration alert, in seconds. */
  persistenceDelay: number;
  vibrationEnabled: boolean;
  /** Alert sensitivity 0..100. Null means firmware does not support it. */
  sensitivity: number | null;
  dailyReminderEnabled: boolean;
  notificationsEnabled: boolean;
}

export interface AppSettings {
  onboardingCompleted: boolean;
  theme: ThemeMode;
  unit: MeasurementUnit;
  alerts: AlertSettings;
  autoReconnect: boolean;
}

export const DEFAULT_ALERT_SETTINGS: AlertSettings = {
  persistenceDelay: 10,
  vibrationEnabled: true,
  sensitivity: null,
  dailyReminderEnabled: false,
  notificationsEnabled: true,
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  onboardingCompleted: false,
  theme: 'dark',
  unit: 'degrees',
  alerts: DEFAULT_ALERT_SETTINGS,
  autoReconnect: true,
};

export const PERSISTENCE_DELAY_PRESETS = [5, 10, 20, 30] as const;
