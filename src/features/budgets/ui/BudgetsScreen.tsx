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
import { Banner, Button, ConfirmDialog, EmptyState, SummaryCard, useTheme } from '@/ui';

/** Pantalla Presupuestos (Brief §12.6): mes, resumen y lista de presupuestos por categoría. */
export function BudgetsScreen() {
  const { colors, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();
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

  const overview = () => (
    <View style={styles.card} accessible accessibilityRole="summary">
      <Text style={[typography.secondary, { color: colors.textMuted }]}>
        {es.budgets.totalMonth}
      </Text>
      <Text style={[typography.amountLarge, { color: colors.text }]}>
        {formatMoney(vm.totalAssigned, DEFAULT_CURRENCY, LOCALE)}
      </Text>
      <View style={styles.summaryRow}>
        <SummaryCard
          title={es.budgets.spent}
          amountMinor={vm.totalSpent}
          currency={DEFAULT_CURRENCY}
          variant="expense"
        />
        <SummaryCard
          title={es.budgets.available}
          amountMinor={vm.totalRemaining}
          currency={DEFAULT_CURRENCY}
          variant="income"
        />
      </View>
      {vm.budgets.length > 0 ? (
        <View style={styles.daysRow}>
          <Text style={[typography.secondary, { color: colors.textMuted }]}>
            {vm.daysLeft !== null && vm.daysLeft > 0 ? es.budgets.daysLeft(vm.daysLeft) : ''}
          </Text>
        </View>
      ) : null}
    </View>
  );

  const body = () => {
    if (vm.status === 'error') {
      return (
        <View style={{ padding: spacing.lg }}>
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
        <Text style={[typography.body, styles.center, { color: colors.textMuted }]}>
          {es.loading}
        </Text>
      );
    }
    return (
      <FlatList
        data={vm.budgets}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={overview}
        ListEmptyComponent={<EmptyState title={es.emptyBudgets} />}
        renderItem={({ item }) => {
          const meta = names.get(item.category_id);
          return (
            <View style={{ marginVertical: spacing.sm, paddingHorizontal: spacing.lg }}>
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
      <View
        style={[
          styles.header,
          { paddingHorizontal: spacing.lg, paddingTop: spacing.lg + insets.top },
        ]}
      >
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
            style={[typography.body, styles.flex, { color: colors.text }]}
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
        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
          <Banner message={es.errors.VALIDATION} variant="error" />
        </View>
      ) : null}
      <View
        style={[
          styles.categoriesHeader,
          { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
        ]}
      >
        <Text style={[typography.title2, styles.flex, { color: colors.text }]}>
          {es.budgets.categories}
        </Text>
        <Text style={[typography.label, { color: colors.textMuted }]}>
          {es.budgets.categoriesCount(vm.budgets.length)}
        </Text>
        <Button label={es.actions.newBudget} onPress={() => setEditing('new')} />
      </View>
      <View style={styles.flex}>{body()}</View>
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg + insets.bottom }}>
        <BudgetForm
          key={editing ?? 'closed'}
          visible={editing !== null}
          initial={formInitial}
          categories={vm.categories}
          saveError={vm.saveError}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        />
      </View>
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
  center: { textAlign: 'center' },
  header: { gap: 8 },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  categoriesHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  daysRow: { paddingTop: 4 },
  card: { gap: 8, paddingHorizontal: 16, paddingBottom: 16 },
});
