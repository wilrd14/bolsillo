import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/ui/Button';
import type { Theme } from '@/ui/theme';
import { useTheme } from '@/ui/use-theme';

export type BannerVariant = 'error' | 'offline' | 'warning' | 'info';

export interface BannerProps {
  readonly visible?: boolean;
  readonly message: string;
  readonly variant?: BannerVariant;
  readonly actionLabel?: string;
  readonly onAction?: () => void;
  readonly accessibilityLabel?: string;
  readonly testID?: string;
}

function getAccentColor(theme: Theme, variant: BannerVariant): string {
  switch (variant) {
    case 'error':
      return theme.colors.danger;
    case 'offline':
    case 'warning':
      return theme.colors.warning;
    case 'info':
      return theme.colors.primary;
  }
}

/** Aviso persistente en pantalla con acción opcional de recuperación. */
export function Banner({
  visible = true,
  message,
  variant = 'info',
  actionLabel,
  onAction,
  accessibilityLabel,
  testID,
}: BannerProps) {
  const theme = useTheme();
  if (!visible) {
    return null;
  }

  const accent = getAccentColor(theme, variant);
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="alert"
      accessibilityLabel={accessibilityLabel ?? message}
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderLeftColor: accent,
          borderRadius: theme.radii.input,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          gap: theme.spacing.sm,
        },
      ]}
    >
      <Text style={[theme.typography.secondary, styles.message, { color: theme.colors.text }]}>
        {message}
      </Text>
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} variant="text" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderLeftWidth: 4,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  message: {
    flex: 1,
  },
});
