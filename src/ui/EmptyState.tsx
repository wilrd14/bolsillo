import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/ui/Button';
import { useTheme } from '@/ui/use-theme';

export interface EmptyStateProps {
  readonly title: string;
  readonly description?: string;
  readonly actionLabel?: string;
  readonly onAction?: () => void;
  readonly icon?: ReactNode;
  readonly accessibilityLabel?: string;
  readonly testID?: string;
}

/** Estado vacío genérico con ícono opcional, mensaje y acción principal. */
export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon,
  accessibilityLabel,
  testID,
}: EmptyStateProps) {
  const theme = useTheme();

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel ?? title}
      style={[styles.container, { padding: theme.spacing.xl, gap: theme.spacing.md }]}
    >
      {icon ?? (
        <View
          style={[
            styles.placeholderIcon,
            {
              backgroundColor: theme.colors.surfaceAlt,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.pill,
            },
          ]}
        >
          <Text style={[theme.typography.title1, { color: theme.colors.primary }]}>—</Text>
        </View>
      )}
      <Text style={[theme.typography.title2, styles.centered, { color: theme.colors.text }]}>
        {title}
      </Text>
      {description ? (
        <Text
          style={[theme.typography.secondary, styles.centered, { color: theme.colors.textMuted }]}
        >
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderIcon: {
    width: 56,
    height: 56,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centered: {
    textAlign: 'center',
  },
});
