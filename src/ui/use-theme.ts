import { useContext } from 'react';
import { useColorScheme } from 'react-native';

import { ThemeContext } from '@/ui/ThemeProvider';
import { getTheme, type Theme } from '@/ui/theme';

/** Devuelve el tema activo desde el proveedor o el esquema del sistema. */
export function useTheme(): Theme {
  const contextTheme = useContext(ThemeContext);
  const systemScheme = useColorScheme();
  return contextTheme ?? getTheme(systemScheme);
}
