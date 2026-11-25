import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { useFonts } from 'expo-font';
import { SplashScreen, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';

import { es } from '@/core/strings/es';
import { DatabaseProvider } from '@/db/provider';
import { ThemeProvider, useTheme } from '@/ui';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

const FONT_TIMEOUT_MS = 3000;

function RootNavigator() {
  const theme = useTheme();

  return (
    <>
      <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="categories"
          options={{
            headerShown: true,
            title: es.categories.title,
            headerTransparent: false,
            headerBackButtonDisplayMode: 'minimal',
            headerShadowVisible: false,
            headerStyle: { backgroundColor: theme.colors.background },
            headerTintColor: theme.colors.text,
            headerTitleStyle: { color: theme.colors.text },
          }}
        />
      </Stack>
    </>
  );
}

/** Layout raíz con el proveedor de tema claro/oscuro. */
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [timedOut, setTimedOut] = useState(false);
  const ready = fontsLoaded || fontError !== null || timedOut;

  // Si las fuentes tardan o fallan, se usa la fuente del sistema: nunca se bloquea la app.
  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), FONT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [ready]);

  if (!ready) {
    return null;
  }

  return (
    <ThemeProvider>
      <DatabaseProvider>
        <RootNavigator />
      </DatabaseProvider>
    </ThemeProvider>
  );
}
