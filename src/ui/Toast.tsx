import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Theme } from '@/ui/theme';
import { useTheme } from '@/ui/use-theme';

export type ToastVariant = 'success' | 'error' | 'info';

export interface ToastProps {
  readonly visible: boolean;
  readonly message: string;
  readonly variant?: ToastVariant;
  readonly durationMs?: number;
  readonly onDismiss?: () => void;
  readonly accessibilityLabel?: string;
  readonly testID?: string;
}

function getAccentColor(theme: Theme, variant: ToastVariant): string {
  switch (variant) {
    case 'success':
      return theme.colors.income;
    case 'error':
      return theme.colors.danger;
    case 'info':
      return theme.colors.primary;
  }
}

/** Notificación breve que se oculta automáticamente tras un tiempo configurable. */
export function Toast({
  visible,
  message,
  variant = 'info',
  durationMs = 3000,
  onDismiss,
  accessibilityLabel,
  testID,
}: ToastProps) {
  const theme = useTheme();

  useEffect(() => {
    if (!visible || !onDismiss || durationMs <= 0) {
      return undefined;
    }
    const timer = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(timer);
  }, [visible, durationMs, onDismiss]);

  if (!visible) {
    return null;
  }

  const accent = getAccentColor(theme, variant);
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      accessibilityLabel={accessibilityLabel ?? message}
      style={[
        styles.container,
        theme.cardElevation,
        {
          backgroundColor: theme.colors.surface,
          borderLeftColor: accent,
          borderRadius: theme.radii.md,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
        },
      ]}
    >
      <Text style={[theme.typography.secondary, { color: theme.colors.text }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderLeftWidth: 4,
    minHeight: 44,
    justifyContent: 'center',
  },
});
