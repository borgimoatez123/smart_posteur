import React, { createContext, useContext, useMemo } from 'react';
import { Provider as PaperProvider, MD3DarkTheme, MD3LightTheme } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import { useSettingsStore } from '../store/settingsStore';
import { palettes, type ThemePalette } from './colors';

interface ThemeContextValue {
  palette: ThemePalette;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({
  palette: palettes.dark,
  isDark: true,
});

export function useAppTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSettingsStore((s) => s.theme);
  const palette = palettes[theme];
  const isDark = theme === 'dark';

  const paperTheme = useMemo(() => {
    const base = isDark ? MD3DarkTheme : MD3LightTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: palette.primary,
        secondary: palette.secondary,
        background: palette.background,
        surface: palette.surface,
        text: palette.text,
        error: palette.error,
        outline: palette.border,
      },
      roundness: 14,
    };
  }, [isDark, palette]);

  const value = useMemo<ThemeContextValue>(() => ({ palette, isDark }), [palette, isDark]);

  return (
    <ThemeContext.Provider value={value}>
      <PaperProvider theme={paperTheme}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        {children}
      </PaperProvider>
    </ThemeContext.Provider>
  );
}
