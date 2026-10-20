import type { ThemeMode } from '../types/settings';

export interface PostureSemanticColors {
  good: string;
  warning: string;
  danger: string;
  neutral: string;
}

export interface ThemePalette {
  mode: ThemeMode;
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  surfaceElevated: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  teal: string;
  navy: string;
  error: string;
  onPrimary: string;
  posture: PostureSemanticColors;
}

export const lightPalette: ThemePalette = {
  mode: 'light',
  primary: '#0EA5A4', // teal
  secondary: '#0B1F3A', // dark navy
  background: '#F4F6F9',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  text: '#0B1F3A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  border: '#E2E8F0',
  teal: '#0EA5A4',
  navy: '#0B1F3A',
  error: '#DC2626',
  onPrimary: '#FFFFFF',
  posture: {
    good: '#16A34A',
    warning: '#F59E0B',
    danger: '#DC2626',
    neutral: '#64748B',
  },
};

export const darkPalette: ThemePalette = {
  mode: 'dark',
  primary: '#14B8A6',
  secondary: '#E2E8F0',
  background: '#0B1F3A',
  surface: '#112A4A',
  surfaceElevated: '#163457',
  text: '#F1F5F9',
  textSecondary: '#CBD5E1',
  textMuted: '#64748B',
  border: '#1E3A5F',
  teal: '#14B8A6',
  navy: '#0B1F3A',
  error: '#EF4444',
  onPrimary: '#0B1F3A',
  posture: {
    good: '#22C55E',
    warning: '#F59E0B',
    danger: '#EF4444',
    neutral: '#64748B',
  },
};

export const palettes: Record<ThemeMode, ThemePalette> = {
  light: lightPalette,
  dark: darkPalette,
};
