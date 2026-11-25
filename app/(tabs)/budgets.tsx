import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/ui';

/** Pantalla de presupuestos vacía (marcador para T-013). */
export default function BudgetsScreen() {
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
        Presupuestos
      </Text>
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
