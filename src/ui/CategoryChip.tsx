import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MIN_TOUCH_TARGET } from '@/ui/theme';
import { useTheme } from '@/ui/use-theme';

export interface CategoryChipProps {
  readonly label: string;
  readonly color: string;
  readonly icon?: ReactNode;
  readonly selected?: boolean;
  readonly onPress?: () => void;
  readonly accessibilityLabel?: string;
  readonly testID?: string;
}

/** Etiqueta de categoría con indicador visual y texto, seleccionable o de solo lectura. */
export function CategoryChip(props: CategoryChipProps) {
  const { label, color, icon, selected = false, onPress, accessibilityLabel, testID } = props;
  const theme = useTheme();
  const backgroundColor = selected ? theme.colors.primary : theme.colors.surfaceAlt;
  const textColor = selected ? theme.colors.onPrimary : theme.colors.text;
  const borderColor = selected ? theme.colors.primary : theme.colors.border;

  const content = (
    <View style={styles.inner}>
      {icon ?? (
        <View
          style={[styles.dot, { backgroundColor: selected ? theme.colors.onPrimary : color }]}
        />
      )}
      <Text
        numberOfLines={1}
        style={[theme.typography.secondary, styles.label, { color: textColor }]}
      >
        {label}
      </Text>
    </View>
  );

  const chipStyle = {
    backgroundColor,
    borderColor,
    borderRadius: theme.radii.pill,
    paddingHorizontal: theme.spacing.md,
  };

  if (onPress) {
    return (
      <Pressable
        testID={testID}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ selected }}
        style={({ pressed }) => [styles.chip, chipStyle, { opacity: pressed ? 0.85 : 1 }]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel ?? label}
      style={[styles.chip, chipStyle]}
    >
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
    borderWidth: 1,
    justifyContent: 'center',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  label: {
    fontWeight: '500',
  },
});
