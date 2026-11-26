import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { addNotificationReceivedListener } from 'expo-notifications';
import { useFonts } from 'expo-font';
import { SplashScreen, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { es } from '@/core/strings/es';
import { DatabaseProvider } from '@/db/provider';
import { AccountProvider } from '@/features/account';
import { ThemeProvider, Toast, useTheme } from '@/ui';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

const FONT_TIMEOUT_MS = 3000;

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
});

function RootNavigator() {
  const theme = useTheme();

  const header = (title: string) => ({
    headerShown: true,
    title,
    headerTransparent: false,
    headerBackButtonDisplayMode: 'minimal' as const,
    headerShadowVisible: false,
    headerStyle: { backgroundColor: theme.colors.background },
    headerTintColor: theme.colors.text,
    headerTitleStyle: { color: theme.colors.text },
  });

  return (
    <>
      <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="categories" options={header(es.categories.title)} />
        <Stack.Screen name="account" options={header(es.account.title)} />
      </Stack>
    </>
  );
}

/** Muestra un Toast cuando un aviso de presupuesto llega con la app en primer plano. */
function ForegroundNotifications() {
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const subscription = addNotificationReceivedListener((notification) => {
      setMessage(notification.request.content.body ?? '');
    });
    return () => subscription.remove();
  }, []);

  return (
    <View style={[styles.toast, { top: insets.top }]}>
      <Toast
        visible={message !== null}
        message={message ?? ''}
        onDismiss={() => setMessage(null)}
      />
    </View>
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
        <AccountProvider>
          <RootNavigator />
          <ForegroundNotifications />
        </AccountProvider>
      </DatabaseProvider>
    </ThemeProvider>
  );
}
