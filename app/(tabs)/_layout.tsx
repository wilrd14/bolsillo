import { Tabs } from 'expo-router';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type AccessibilityState,
  type ColorValue,
  type GestureResponderEvent,
} from 'react-native';

import { CAPTURE_BUTTON_SIZE, MIN_TOUCH_TARGET, useTheme } from '@/ui';

interface CaptureButtonProps {
  readonly onPress?: (event: GestureResponderEvent) => void;
  readonly accessibilityState?: AccessibilityState;
}

function CaptureTabButton({ onPress, accessibilityState }: CaptureButtonProps) {
  const theme = useTheme();
  const focused = Boolean(accessibilityState?.selected);

  return (
    <View style={styles.captureSlot}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Captura"
        accessibilityState={{ selected: focused }}
        style={({ pressed }) => [
          styles.captureButton,
          {
            backgroundColor: theme.colors.primary,
            borderRadius: theme.radii.pill,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <Text style={[theme.typography.title1, { color: theme.colors.onPrimary }]}>+</Text>
      </Pressable>
    </View>
  );
}

function TabGlyph({ glyph, color }: { readonly glyph: string; readonly color: ColorValue }) {
  return <Text style={[styles.glyph, { color }]}>{glyph}</Text>;
}

/** Navegación principal de 5 pestañas según Brief §3. */
export default function TabsLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTitleStyle: [theme.typography.title2, { color: theme.colors.text }],
        headerShadowVisible: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          minHeight: CAPTURE_BUTTON_SIZE + theme.spacing.sm,
          paddingBottom: theme.spacing.xs,
        },
        tabBarItemStyle: {
          minHeight: MIN_TOUCH_TARGET,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarAccessibilityLabel: 'Inicio',
          tabBarIcon: ({ color }) => <TabGlyph glyph="●" color={color} />,
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: 'Movimientos',
          tabBarAccessibilityLabel: 'Movimientos',
          tabBarIcon: ({ color }) => <TabGlyph glyph="≡" color={color} />,
        }}
      />
      <Tabs.Screen
        name="capture"
        options={{
          title: 'Captura',
          tabBarLabel: '',
          tabBarButton: (props) => <CaptureTabButton {...props} />,
        }}
      />
      <Tabs.Screen
        name="budgets"
        options={{
          title: 'Presupuestos',
          tabBarAccessibilityLabel: 'Presupuestos',
          tabBarIcon: ({ color }) => <TabGlyph glyph="◔" color={color} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'Más',
          tabBarAccessibilityLabel: 'Más',
          tabBarIcon: ({ color }) => <TabGlyph glyph="⋯" color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  captureSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButton: {
    width: CAPTURE_BUTTON_SIZE,
    height: CAPTURE_BUTTON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: {
    fontSize: 18,
    fontWeight: '600',
  },
});
