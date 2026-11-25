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
      style={[
        theme.cardElevation,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radii.card,
          padding: theme.spacing.lg,
          gap: theme.spacing.md,
        },
      ]}
    >
      <View style={styles.header}>
        <View style={[styles.icon, { backgroundColor: color ?? theme.colors.primary }]} />
        <View style={styles.flex}>
          <Text
            style={[theme.typography.bodyMedium, { color: theme.colors.text }]}
            numberOfLines={1}
          >
            {name}
          </Text>
          <Text
            style={[theme.typography.secondary, { color: theme.colors.textMuted }]}
            numberOfLines={2}
          >
            {es.budgets.spentOfLimit(formattedSpent, formattedLimit)}
          </Text>
        </View>
        <Text
          accessibilityRole="text"
          style={[
            theme.typography.label,
            styles.badge,
            {
              borderRadius: theme.radii.pill,
              backgroundColor: badgeColor ?? theme.colors.surfaceAlt,
              color: badgeColor ? theme.colors.onPrimary : theme.colors.textMuted,
            },
          ]}
        >
          {`${percent} %`}
        </Text>
      </View>
      <BudgetBar
        bare
        title={name}
        spentLabel={formattedSpent}
        limitLabel={formattedLimit}
        percent={percent}
        statusText={`${percent} %`}
      />
      {status === 'exceeded' ? (
        <Text
          accessibilityRole="text"
          style={[theme.typography.label, { color: theme.colors.danger }]}
        >
          {`${es.budgets.completed} ${es.budgets.overGoal(formatMoney(-remainingMinor, DEFAULT_CURRENCY, LOCALE))}`}
        </Text>
      ) : status === 'warning' ? (
        <Text
          accessibilityRole="text"
          style={[theme.typography.label, { color: theme.colors.textMuted }]}
        >
          {es.budgetWarning(percent, name)}
        </Text>
      ) : null}
      <View style={[styles.actions, { gap: theme.spacing.sm }]}>
        <Pressable
          onPress={onEdit}
          accessibilityRole="button"
          accessibilityLabel={`${es.budgets.editTitle}: ${name}`}
          style={styles.action}
        >
          <Text style={[theme.typography.label, { color: theme.colors.primary }]}>
            {es.budgets.editTitle}
          </Text>
        </Pressable>
        <Pressable
          onPress={onDelete}
          accessibilityRole="button"
          accessibilityLabel={`${es.budgets.deleteBudget}: ${name}`}
          style={styles.action}
        >
          <Text style={[theme.typography.label, { color: theme.colors.danger }]}>
            {es.budgets.deleteBudget}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 12, height: 12, borderRadius: 6 },
  badge: {
    minWidth: 44,
    textAlign: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end' },
  action: {
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
