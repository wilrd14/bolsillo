import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MIN_TOUCH_TARGET, type Theme } from '@/ui/theme';
import { useTheme } from '@/ui/use-theme';

export type BudgetBarStatus = 'normal' | 'warning' | 'exceeded';

export interface BudgetBarProps {
  readonly title: string;
  readonly spentLabel: string;
  readonly limitLabel: string;
  readonly percent: number;
  readonly statusText: string;
  readonly status?: BudgetBarStatus;
  readonly onPress?: () => void;
  readonly accessibilityLabel?: string;
  readonly testID?: string;
}

function resolveStatus(percent: number, explicit?: BudgetBarStatus): BudgetBarStatus {
  if (explicit) {
    return explicit;
  }
  if (percent >= 100) {
    return 'exceeded';
  }
  if (percent >= 80) {
    return 'warning';
  }
  return 'normal';
}

function getStatusColor(theme: Theme, status: BudgetBarStatus): string {
  switch (status) {
    case 'exceeded':
      return theme.colors.danger;
    case 'warning':
      return theme.colors.warning;
    case 'normal':
      return theme.colors.primary;
  }
}

function BudgetBarBody({
  title,
  spentLabel,
  limitLabel,
  statusText,
  fillColor,
  clampedWidth,
}: {
  readonly title: string;
  readonly spentLabel: string;
  readonly limitLabel: string;
  readonly statusText: string;
  readonly fillColor: string;
  readonly clampedWidth: number;
}) {
  const theme = useTheme();
  return (
    <View style={styles.content}>
      <View style={styles.header}>
        <Text style={[theme.typography.title2, styles.title, { color: theme.colors.text }]}>
          {title}
        </Text>
        <Text style={[theme.typography.label, { color: fillColor }]}>{statusText}</Text>
      </View>
      <View
        style={[
          styles.track,
          { backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radii.pill },
        ]}
      >
        <View
          style={[
            styles.fill,
            {
              width: `${clampedWidth}%`,
              backgroundColor: fillColor,
              borderRadius: theme.radii.pill,
            },
          ]}
        />
      </View>
      <View style={styles.footer}>
        <Text style={[theme.typography.secondary, { color: theme.colors.textMuted }]}>
          {spentLabel}
        </Text>
        <Text style={[theme.typography.secondary, { color: theme.colors.textMuted }]}>
          {limitLabel}
        </Text>
      </View>
    </View>
  );
}

/** Barra de progreso de presupuesto con color y texto de estado simultáneos. */
export function BudgetBar(props: BudgetBarProps) {
  const { title, spentLabel, limitLabel, percent, statusText, status, onPress, testID } = props;
  const theme = useTheme();
  const fillColor = getStatusColor(theme, resolveStatus(percent, status));
  const clampedWidth = Math.max(0, Math.min(percent, 100));
  const resolvedLabel =
    props.accessibilityLabel ?? `${title}, ${statusText}, ${spentLabel} / ${limitLabel}`;
  const cardStyle = [
    styles.card,
    theme.cardElevation,
    {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radii.card,
      padding: theme.spacing.lg,
    },
  ];
  const body = (
    <BudgetBarBody
      title={title}
      spentLabel={spentLabel}
      limitLabel={limitLabel}
      statusText={statusText}
      fillColor={fillColor}
      clampedWidth={clampedWidth}
    />
  );

  if (onPress) {
    return (
      <Pressable
        testID={testID}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={resolvedLabel}
        style={({ pressed }) => [...cardStyle, { opacity: pressed ? 0.9 : 1 }]}
      >
        {body}
      </Pressable>
    );
  }

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={resolvedLabel}
      accessibilityValue={{ min: 0, max: 100, now: clampedWidth }}
      style={cardStyle}
    >
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: MIN_TOUCH_TARGET,
  },
  content: {
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    flex: 1,
  },
  track: {
    height: 8,
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
