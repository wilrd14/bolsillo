import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/ui';

/** Pantalla inicial vacía (marcador para T-016). */
export default function HomeScreen() {
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
        Inicio
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
