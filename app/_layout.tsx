import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { es } from '@/core/strings/es';
import { DatabaseProvider } from '@/db/provider';
import { ThemeProvider, useTheme } from '@/ui';

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
  return (
    <ThemeProvider>
      <DatabaseProvider>
        <RootNavigator />
      </DatabaseProvider>
    </ThemeProvider>
  );
}
