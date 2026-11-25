import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/ui';

/** Pantalla de captura rápida vacía (marcador para T-009). */
export default function CaptureScreen() {
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
        Captura
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
