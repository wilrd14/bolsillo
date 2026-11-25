import { createContext, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { getTheme, type Theme, type ThemeMode } from '@/ui/theme';

export const ThemeContext = createContext<Theme | null>(null);

export interface ThemeProviderProps {
  readonly mode?: ThemeMode;
  readonly children: ReactNode;
}

/** Provee los tokens visuales del tema claro u oscuro al árbol de componentes. */
export function ThemeProvider({ mode, children }: ThemeProviderProps) {
  const systemScheme = useColorScheme();
  const theme = getTheme(mode ?? systemScheme);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}
