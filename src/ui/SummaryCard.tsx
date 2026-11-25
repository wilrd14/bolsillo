import { StyleSheet, Text, View } from 'react-native';

import { formatMoney } from '@/core/money';
import type { Theme } from '@/ui/theme';
import { useTheme } from '@/ui/use-theme';

export type SummaryCardVariant = 'expense' | 'income' | 'balance';

export interface SummaryCardProps {
  readonly title: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly locale?: string;
  readonly variant: SummaryCardVariant;
  readonly deltaText?: string;
  readonly accessibilityLabel?: string;
  readonly testID?: string;
}

function getAmountColor(theme: Theme, variant: SummaryCardVariant, amountMinor: number): string {
  if (variant === 'expense') {
    return theme.colors.expense;
  }
  if (variant === 'income') {
    return theme.colors.income;
  }
  if (amountMinor < 0) {
    return theme.colors.expense;
  }
  return amountMinor > 0 ? theme.colors.income : theme.colors.text;
}

function formatSignedAmount(
  amountMinor: number,
  currency: string,
  locale: string,
  variant: SummaryCardVariant,
): string {
  const formatted = formatMoney(Math.abs(amountMinor), currency, locale);
  if (variant === 'expense' || amountMinor < 0) {
    return `-${formatted}`;
  }
  if (variant === 'income' || amountMinor > 0) {
    return `+${formatted}`;
  }
  return formatted;
}

/** Tarjeta de resumen financiero con cifra destacada, signo y variación opcional. */
export function SummaryCard({
  title,
  amountMinor,
  currency,
  locale = 'es-DO',
  variant,
  deltaText,
  accessibilityLabel,
  testID,
}: SummaryCardProps) {
  const theme = useTheme();
  const amountColor = getAmountColor(theme, variant, amountMinor);
  const displayAmount = formatSignedAmount(amountMinor, currency, locale, variant);
  const resolvedLabel = accessibilityLabel ?? `${title}: ${displayAmount}`;

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="summary"
      accessibilityLabel={resolvedLabel}
      style={[
        styles.card,
        theme.cardElevation,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radii.card,
          padding: theme.spacing.lg,
          gap: theme.spacing.xs,
        },
      ]}
    >
      <Text style={[theme.typography.secondaryMedium, { color: theme.colors.textMuted }]}>
        {title}
      </Text>
      <Text style={[theme.typography.title1, { color: amountColor }]}>{displayAmount}</Text>
      {deltaText ? (
        <Text style={[theme.typography.label, { color: theme.colors.textMuted }]}>{deltaText}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minWidth: 140,
  },
});
