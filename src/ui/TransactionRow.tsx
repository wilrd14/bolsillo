import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatMoney } from '@/core/money';
import { useTheme } from '@/ui/use-theme';

export type TransactionRowKind = 'expense' | 'income';

export interface TransactionRowProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly dateLabel: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly locale?: string;
  readonly kind: TransactionRowKind;
  readonly categoryColor: string;
  readonly categoryIcon?: ReactNode;
  readonly hasAttachment?: boolean;
  readonly attachmentLabel?: string;
  readonly onPress?: () => void;
  readonly accessibilityLabel?: string;
  readonly testID?: string;
}

function TransactionRowContent(
  props: TransactionRowProps & { readonly formattedAmount: string; readonly amountColor: string },
) {
  const {
    title,
    subtitle,
    dateLabel,
    categoryColor,
    categoryIcon,
    hasAttachment,
    attachmentLabel = 'Adjunto',
    formattedAmount,
    amountColor,
  } = props;
  const theme = useTheme();

  return (
    <>
      <View
        style={[
          styles.badge,
          {
            backgroundColor: /^#[0-9a-f]{6}$/i.test(categoryColor)
              ? `${categoryColor}26`
              : theme.colors.surfaceAlt,
            borderRadius: theme.radii.pill,
          },
        ]}
      >
        {categoryIcon ?? <View style={[styles.badgeDot, { backgroundColor: categoryColor }]} />}
      </View>
      <View style={styles.details}>
        <Text numberOfLines={1} style={[theme.typography.bodyMedium, { color: theme.colors.text }]}>
          {title}
        </Text>
        <View style={styles.metaRow}>
          {subtitle ? (
            <Text
              numberOfLines={1}
              style={[theme.typography.secondary, { color: theme.colors.textMuted }]}
            >
              {subtitle}
            </Text>
          ) : null}
          <Text style={[theme.typography.label, { color: theme.colors.textMuted }]}>
            {dateLabel}
          </Text>
          {hasAttachment ? (
            <Text style={[theme.typography.label, { color: theme.colors.primary }]}>
              {attachmentLabel}
            </Text>
          ) : null}
        </View>
      </View>
      <Text style={[theme.typography.title2, { color: amountColor }]}>{formattedAmount}</Text>
    </>
  );
}

/** Fila de movimiento financiero con categoría, fecha, adjunto opcional e importe con signo. */
export function TransactionRow(props: TransactionRowProps) {
  const {
    title,
    dateLabel,
    amountMinor,
    currency,
    locale = 'es-DO',
    kind,
    onPress,
    accessibilityLabel,
    testID,
  } = props;
  const theme = useTheme();
  const sign = kind === 'expense' ? '-' : '+';
  const amountColor = kind === 'expense' ? theme.colors.expense : theme.colors.income;
  const formattedAmount = `${sign}${formatMoney(amountMinor, currency, locale)}`;
  const resolvedLabel = accessibilityLabel ?? `${title}, ${formattedAmount}, ${dateLabel}`;
  const rowStyle = {
    backgroundColor: theme.colors.surface,
    borderBottomColor: theme.colors.border,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  };
  const body = (
    <TransactionRowContent {...props} formattedAmount={formattedAmount} amountColor={amountColor} />
  );

  if (onPress) {
    return (
      <Pressable
        testID={testID}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={resolvedLabel}
        style={({ pressed }) => [styles.row, rowStyle, { opacity: pressed ? 0.85 : 1 }]}
      >
        {body}
      </Pressable>
    );
  }

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="text"
      accessibilityLabel={resolvedLabel}
      style={[styles.row, rowStyle]}
    >
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
  },
  badge: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
  },
  details: {
    flex: 1,
    gap: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
});
