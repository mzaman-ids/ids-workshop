import type { PaletteMode } from '@mui/material';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';

type ColorModeContextType = {
  preference: ThemePreference;
  resolvedMode: PaletteMode;
  setPreference: (p: ThemePreference) => void;
};

export const ColorModeContext = createContext<ColorModeContextType>({
  preference: 'light',
  resolvedMode: 'light',
  setPreference: () => { },
});

export function useColorMode() {
  return useContext(ColorModeContext);
}

const STORAGE_KEY = 'ids_color_mode';
const VALID_PREFERENCES: ThemePreference[] = ['light', 'dark', 'system'];

function getSystemMode(): PaletteMode {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getInitialPreference(): ThemePreference {
  if (typeof window === 'undefined') return 'light';
  const stored = localStorage.getItem(STORAGE_KEY) as ThemePreference | null;
  return stored && VALID_PREFERENCES.includes(stored) ? stored : 'light';
}

function resolveMode(preference: ThemePreference): PaletteMode {
  if (preference === 'system') return getSystemMode();
  return preference;
}

export function ColorModeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(getInitialPreference);
  const [resolvedMode, setResolvedMode] = useState<PaletteMode>(() => resolveMode(getInitialPreference()));

  useEffect(() => {
    if (preference !== 'system') {
      setResolvedMode(preference);
      return;
    }

    setResolvedMode(getSystemMode());

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      setResolvedMode(e.matches ? 'dark' : 'light');
    };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [preference]);

  const setPreference = useCallback((p: ThemePreference) => {
    localStorage.setItem(STORAGE_KEY, p);
    setPreferenceState(p);
  }, []);

  const value = useMemo(
    () => ({ preference, resolvedMode, setPreference }),
    [preference, resolvedMode, setPreference],
  );

  return <ColorModeContext.Provider value={value}>{children}</ColorModeContext.Provider>;
}
