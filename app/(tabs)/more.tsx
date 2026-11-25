import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { es } from '@/core/strings/es';
import { Button, useTheme } from '@/ui';

/** Pantalla Más vacía (marcador para categorías, recurrentes, cuenta y ajustes). */
export default function MoreScreen() {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.background, padding: theme.spacing.lg },
      ]}
    >
      <Text
        accessibilityRole="header"
        style={[theme.typography.title1, { color: theme.colors.text }]}
      >
        Más
      </Text>
      <Button
        label={es.categories.open}
        variant="secondary"
        accessibilityHint={es.categories.openHint}
        onPress={() => router.push('/categories')}
        style={{ marginTop: theme.spacing.lg }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
