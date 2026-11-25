import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMemo, useState } from 'react';

import { formatMoney } from '@/core/money';
import { es } from '@/core/strings/es';
import { useNotificationPermission } from '@/features/budgets';
import {
  DEFAULT_CURRENCY,
  LOCALE,
  formatMonthLabel,
  useBudgets,
  type BudgetDraft,
  type BudgetProgress,
} from '@/features/budgets/model/use-budgets';
import { BudgetCard } from '@/features/budgets/ui/BudgetCard';
import { BudgetForm } from '@/features/budgets/ui/BudgetForm';
import { Banner, Button, CAPTURE_BUTTON_SIZE, ConfirmDialog, EmptyState, useTheme } from '@/ui';

/** Pantalla Presupuestos (Brief §12.6): mes, resumen y lista de presupuestos por categoría. */
export function BudgetsScreen() {
  const { colors, spacing, radii, typography, cardElevation } = useTheme();
  const insets = useSafeAreaInsets();
  // Alto de la barra de pestañas (app/(tabs)/_layout.tsx): minHeight del botón de captura + sm.
  const tabBarHeight = CAPTURE_BUTTON_SIZE + spacing.sm;
  const vm = useBudgets();
  const [editing, setEditing] = useState<'new' | string | null>(null);
  const [toDelete, setToDelete] = useState<BudgetProgress | null>(null);

  const names = useMemo(
    () =>
      new Map<string, { name: string; color: string | null }>(
        vm.categories.map((cat) => [cat.id, { name: cat.name, color: cat.color }]),
      ),
    [vm.categories],
  );

  const editingBudget =
    editing !== null && editing !== 'new' ? vm.budgets.find((b) => b.id === editing) : null;
  const formInitial = editingBudget
    ? { category_id: editingBudget.category_id, limit_minor: editingBudget.limit_minor }
    : null;

  // Al crear el primer presupuesto se pide el permiso de notificaciones; es opcional.
  const requestPermission = useNotificationPermission();

  const handleSave = async (draft: BudgetDraft) => {
    const wasEmpty = vm.budgets.length === 0 && editingBudget === null;
    const ok = editingBudget ? await vm.update(editingBudget.id, draft) : await vm.create(draft);
    if (ok) {
      setEditing(null);
      if (wasEmpty) {
        // El fallo no invalida el presupuesto creado: notificaciones sin permiso siguen funcionando.
        void requestPermission().catch(() => undefined);
      }
    }
  };

  const stat = (title: string, amountMinor: number, color: string, prefix: string) => {
    const text = `${prefix}${formatMoney(Math.abs(amountMinor), DEFAULT_CURRENCY, LOCALE)}`;
    return (
      <View
        accessible
        accessibilityRole="summary"
        accessibilityLabel={`${title}: ${text}`}
        style={[
          styles.stat,
          { backgroundColor: colors.surfaceAlt, borderRadius: radii.card, padding: spacing.md },
        ]}
      >
        <Text style={[typography.secondaryMedium, { color: colors.textMuted }]} numberOfLines={1}>
          {title}
        </Text>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          style={[typography.title2, { color }]}
        >
          {text}
        </Text>
      </View>
    );
  };

  const header = () => (
    <View style={{ gap: spacing.md, paddingBottom: spacing.sm }}>
      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
        <Text style={[typography.label, { color: colors.primary }]}>
          {es.budgets.eyebrow.toUpperCase()}
        </Text>
        <Text accessibilityRole="header" style={[typography.title1, { color: colors.text }]}>
          {es.budgets.title}
        </Text>
        <View style={styles.monthRow}>
          <Button
            label="‹"
            variant="secondary"
            onPress={() => vm.shiftMonth(-1)}
            accessibilityLabel={es.transactions.previousMonth}
          />
          <Text
            accessibilityRole="text"
            accessibilityLabel={es.budgets.monthSelector}
            numberOfLines={1}
            style={[typography.bodyMedium, styles.flex, styles.centerText, { color: colors.text }]}
          >
            {formatMonthLabel(vm.month)}
          </Text>
          <Button
            label="›"
            variant="secondary"
            onPress={() => vm.shiftMonth(1)}
            accessibilityLabel={es.transactions.nextMonth}
          />
        </View>
      </View>
      {vm.saveError ? (
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Banner message={es.errors.VALIDATION} variant="error" />
        </View>
      ) : null}
      <View
        accessible
        accessibilityRole="summary"
        style={[
          cardElevation,
          {
            backgroundColor: colors.surface,
            borderRadius: radii.card,
            padding: spacing.lg,
            gap: spacing.sm,
            marginHorizontal: spacing.lg,
          },
        ]}
      >
        <Text style={[typography.secondary, { color: colors.textMuted }]}>
          {es.budgets.totalMonth}
        </Text>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          style={[typography.amountLarge, styles.total, { color: colors.text }]}
        >
          {formatMoney(vm.totalAssigned, DEFAULT_CURRENCY, LOCALE)}
        </Text>
        <View style={[styles.summaryRow, { gap: spacing.sm }]}>
          {stat(es.budgets.spent, vm.totalSpent, colors.expense, '-')}
          {stat(
            es.budgets.available,
            vm.totalRemaining,
            colors.income,
            vm.totalRemaining < 0 ? '-' : '+',
          )}
        </View>
        {vm.budgets.length > 0 && vm.daysLeft !== null && vm.daysLeft > 0 ? (
          <Text style={[typography.secondary, { color: colors.textMuted }]}>
            {es.budgets.daysLeft(vm.daysLeft)}
          </Text>
        ) : null}
      </View>
      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
        <View style={styles.categoriesTitle}>
          <Text
            numberOfLines={1}
            style={[typography.title2, styles.shrink, { color: colors.text }]}
          >
            {es.budgets.categories}
          </Text>
          <Text style={[typography.label, { color: colors.textMuted }]} numberOfLines={1}>
            {es.budgets.categoriesCount(vm.budgets.length)}
          </Text>
        </View>
        <Button label={es.actions.newBudget} onPress={() => setEditing('new')} />
      </View>
    </View>
  );

  const body = () => {
    if (vm.status === 'error') {
      return (
        <View style={{ padding: spacing.lg, paddingTop: insets.top + spacing.lg }}>
          <Banner
            message={es.recoverableError}
            variant="error"
            actionLabel={es.actions.retry}
            onAction={vm.retry}
          />
        </View>
      );
    }
    if (vm.status === 'loading') {
      return (
        <Text
          style={[
            typography.body,
            styles.centerText,
            { color: colors.textMuted, padding: spacing.xl, paddingTop: insets.top + spacing.xl },
          ]}
        >
          {es.loading}
        </Text>
      );
    }
    return (
      <FlatList
        data={vm.budgets}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        ListEmptyComponent={<EmptyState title={es.emptyBudgets} />}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingTop: insets.top + spacing.lg,
          paddingBottom: tabBarHeight + insets.bottom + spacing.lg,
        }}
        renderItem={({ item }) => {
          const meta = names.get(item.category_id);
          return (
            <View style={{ marginTop: spacing.md, paddingHorizontal: spacing.lg }}>
              <BudgetCard
                name={meta?.name ?? item.category_id}
                color={meta?.color ?? null}
                spentMinor={item.spent_minor}
                limitMinor={item.limit_minor}
                percent={item.percentage}
                remainingMinor={item.remaining_minor}
                onEdit={() => setEditing(item.id)}
                onDelete={() => setToDelete(item)}
              />
            </View>
          );
        }}
      />
    );
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={styles.flex}>{body()}</View>
      <BudgetForm
        key={editing ?? 'closed'}
        visible={editing !== null}
        initial={formInitial}
        categories={vm.categories}
        saveError={vm.saveError}
        onSave={handleSave}
        onCancel={() => setEditing(null)}
      />
      <ConfirmDialog
        visible={toDelete !== null}
        title={es.budgets.deleteConfirmTitle}
        message={es.budgets.deleteConfirmMessage}
        confirmLabel={es.budgets.deleteBudget}
        cancelLabel={es.categories.cancel}
        variant="destructive"
        onConfirm={() => {
          const target = toDelete;
          setToDelete(null);
          if (target) void vm.delete(target.id);
        }}
        onCancel={() => setToDelete(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  centerText: { textAlign: 'center' },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  categoriesTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  summaryRow: { flexDirection: 'row' },
  stat: { flex: 1, minWidth: 0, gap: 4 },
  total: { minHeight: 44 },
});
