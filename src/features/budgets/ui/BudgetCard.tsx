import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatMoney } from '@/core/money';
import { es } from '@/core/strings/es';
import { BudgetBar, MIN_TOUCH_TARGET, type BudgetBarStatus, useTheme } from '@/ui';
import { DEFAULT_CURRENCY, LOCALE } from '../model/use-budgets';

export interface BudgetCardProps {
  readonly name: string;
  readonly color: string | null;
  readonly spentMinor: number;
  readonly limitMinor: number;
  readonly percent: number;
  readonly remainingMinor: number;
  readonly onEdit: () => void;
  readonly onDelete: () => void;
}

function statusOf(percent: number): BudgetBarStatus {
  return percent >= 100 ? 'exceeded' : percent >= 80 ? 'warning' : 'normal';
}

/** Tarjeta de presupuesto por categoría con barra, insignia de porcentaje y nota de estado. */
export function BudgetCard({
  name,
  color,
  spentMinor,
  limitMinor,
  percent,
  remainingMinor,
  onEdit,
  onDelete,
}: BudgetCardProps) {
  const theme = useTheme();
  const status = statusOf(percent);
  const formattedSpent = formatMoney(spentMinor, DEFAULT_CURRENCY, LOCALE);
  const formattedLimit = formatMoney(limitMinor, DEFAULT_CURRENCY, LOCALE);
  const badgeColor =
    status === 'exceeded'
      ? theme.colors.danger
      : status === 'warning'
        ? theme.colors.warning
        : null;

  return (
    <View
      accessible
      accessibilityRole="summary"
      accessibilityLabel={`${name}: ${formattedSpent} ${es.budgets.spentOfLimit(formattedSpent, formattedLimit)}`}
      style={[theme.cardElevation, styles.card]}
    >
      <Pressable
        onPress={onEdit}
        accessibilityRole="button"
        accessibilityLabel={`${es.budgets.editTitle}: ${name}`}
        style={styles.pressable}
      >
        <View style={styles.header}>
          <View style={[styles.icon, { backgroundColor: color ?? theme.colors.primary }]} />
          <Text
            style={[theme.typography.bodyMedium, styles.flex, { color: theme.colors.text }]}
            numberOfLines={1}
          >
            {name}
          </Text>
          <Text
            accessibilityRole="text"
            style={[
              theme.typography.label,
              styles.badge,
              {
                backgroundColor: badgeColor ?? theme.colors.surfaceAlt,
                color: badgeColor ? theme.colors.onPrimary : theme.colors.textMuted,
              },
            ]}
          >
            {`${percent} %`}
          </Text>
        </View>
        <Text
          style={[theme.typography.secondary, { color: theme.colors.textMuted }]}
          numberOfLines={1}
        >
          {es.budgets.spentOfLimit(formattedSpent, formattedLimit)}
        </Text>
      </Pressable>
      <BudgetBar
        title={name}
        spentLabel={formattedSpent}
        limitLabel={formattedLimit}
        percent={percent}
        statusText={`${percent} %`}
      />
      {status === 'exceeded' ? (
        <Text
          accessibilityRole="text"
          style={[theme.typography.label, styles.note, { color: theme.colors.danger }]}
        >
          {`${es.budgets.completed} ${es.budgets.overGoal(formatMoney(-remainingMinor, DEFAULT_CURRENCY, LOCALE))}`}
        </Text>
      ) : status === 'warning' ? (
        <Text
          accessibilityRole="text"
          style={[theme.typography.label, styles.note, { color: theme.colors.textMuted }]}
        >
          {es.budgetWarning(percent, name)}
        </Text>
      ) : null}
      <Pressable
        onPress={onDelete}
        accessibilityRole="button"
        accessibilityLabel={`${es.budgets.deleteBudget}: ${name}`}
        style={styles.delete}
      >
        <Text style={[theme.typography.label, { color: theme.colors.danger }]}>
          {es.budgets.deleteBudget}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: {
    gap: 12,
    padding: 16,
    minHeight: MIN_TOUCH_TARGET + 24,
  },
  pressable: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  icon: {
    width: 12,
    height: 12,
    borderRadius: 24,
  },
  badge: {
    minWidth: 28,
    textAlign: 'center',
  },
  note: { textAlign: 'right' },
  delete: {
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
  },
});
