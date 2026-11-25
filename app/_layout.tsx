import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { DatabaseProvider } from '@/db/provider';
import { ThemeProvider, useTheme } from '@/ui';

function RootNavigator() {
  const theme = useTheme();

  return (
    <>
      <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}

/** Layout raíz con el proveedor de tema claro/oscuro. */
export default function RootLayout() {
  return (
    <ThemeProvider>
      <DatabaseProvider>
        <RootNavigator />
      </DatabaseProvider>
    </ThemeProvider>
  );
}
