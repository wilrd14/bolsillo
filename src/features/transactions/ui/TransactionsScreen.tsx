import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { formatMoney } from '@/core/money';
import { es } from '@/core/strings/es';
import {
  formatMonth,
  useTransactions,
  type ListItem,
} from '@/features/transactions/model/use-transactions';
import {
  Banner,
  Button,
  CategoryChip,
  EmptyState,
  MIN_TOUCH_TARGET,
  TransactionRow,
  useTheme,
} from '@/ui';

const LOCALE = 'es-DO';

const KIND_FILTERS = [
  { value: null, label: es.transactions.all },
  { value: 'expense', label: es.capture.kindExpense },
  { value: 'income', label: es.capture.kindIncome },
] as const;

/** Pantalla Movimientos (Brief §12.5): búsqueda, filtros, agrupación por día y borrado con deshacer. */
export function TransactionsScreen() {
  const { colors, spacing, radii, typography, cardElevation } = useTheme();
  const vm = useTransactions();
  const { refresh } = vm;

  // Refleja ediciones y borrados hechos en el detalle sin mostrar el estado de carga.
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const renderItem = ({ item }: { item: ListItem }) => {
    if (item.type === 'header') {
      const total = `${item.totalMinor > 0 ? '+' : ''}${formatMoney(item.totalMinor, item.currency, LOCALE)}`;
      return (
        <View
          style={[
            styles.dayHeader,
            { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
          ]}
        >
          <Text
            accessibilityRole="header"
            style={[typography.bodyMedium, styles.flex, { color: colors.text }]}
          >
            {item.label}
          </Text>
          <Text
            style={[
              typography.label,
              {
                color: item.totalMinor >= 0 ? colors.income : colors.expense,
                backgroundColor: colors.surfaceAlt,
                borderRadius: radii.pill,
                paddingHorizontal: spacing.sm,
                paddingVertical: spacing.xs,
              },
            ]}
          >
            {es.transactions.dayTotal(total)}
          </Text>
        </View>
      );
    }
    return (
      <View
        style={[
          styles.rowWrap,
          cardElevation,
          {
            backgroundColor: colors.surface,
            borderRadius: radii.card,
            marginHorizontal: spacing.lg,
            marginBottom: spacing.sm,
          },
        ]}
      >
        <View style={[styles.flex, styles.rowInner]}>
          <TransactionRow
            title={item.title}
            subtitle={item.categoryName}
            dateLabel={item.dateLabel}
            amountMinor={item.amountMinor}
            currency={item.currency}
            kind={item.kind}
            categoryColor={item.categoryColor ?? colors.primary}
            onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: item.id } })}
          />
        </View>
        <Pressable
          onPress={() => vm.requestDelete(item.id)}
          accessibilityRole="button"
          accessibilityLabel={`${es.transactions.deleteItem}: ${item.title}`}
          style={styles.delete}
        >
          <Text style={[typography.label, { color: colors.danger }]}>
            {es.transactions.deleteItem}
          </Text>
        </Pressable>
      </View>
    );
  };

  const empty = () => {
    if (vm.status === 'loading') {
      return (
        <Text
          accessibilityRole="text"
          style={[typography.body, styles.center, { color: colors.textMuted, padding: spacing.xl }]}
        >
          {es.loading}
        </Text>
      );
    }
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
    return vm.hasFilters ? (
      <EmptyState
        title={es.transactions.noResults}
        description={es.transactions.noResultsHint}
        actionLabel={es.transactions.clearFilters}
        onAction={vm.clearFilters}
      />
    ) : (
      <EmptyState title={es.emptyTransactions} />
    );
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={{ padding: spacing.lg, gap: spacing.sm }}>
        <Text style={[typography.label, { color: colors.primary }]}>
          {es.transactions.eyebrow.toUpperCase()}
        </Text>
        <Text accessibilityRole="header" style={[typography.title1, { color: colors.text }]}>
          {es.transactions.title}
        </Text>
        <TextInput
          value={vm.filters.search}
          onChangeText={vm.setSearch}
          placeholder={es.transactions.search}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={es.transactions.search}
          returnKeyType="search"
          style={[
            typography.body,
            styles.field,
            cardElevation,
            {
              color: colors.text,
              backgroundColor: colors.surface,
              borderRadius: radii.pill,
              paddingHorizontal: spacing.lg,
            },
          ]}
        />
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel={es.transactions.filterKind}
          style={styles.chips}
        >
          {KIND_FILTERS.map((item) => {
            const selected = vm.filters.kind === item.value;
            return (
              <Pressable
                key={item.label}
                onPress={() => vm.setKind(item.value)}
                accessibilityRole="radio"
                accessibilityLabel={item.label}
                accessibilityState={{ selected }}
                style={[
                  styles.kind,
                  {
                    borderRadius: radii.pill,
                    backgroundColor: selected ? colors.primary : colors.surfaceAlt,
                  },
                ]}
              >
                <Text
                  style={[
                    typography.bodyMedium,
                    { color: selected ? colors.onPrimary : colors.text },
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <FlatList
          horizontal
          data={vm.categories}
          keyExtractor={(category) => category.id}
          showsHorizontalScrollIndicator={false}
          accessibilityLabel={es.transactions.filterCategory}
          contentContainerStyle={{ gap: spacing.sm }}
          ListHeaderComponent={
            <CategoryChip
              label={es.transactions.allCategories}
              color={colors.primary}
              selected={vm.filters.categoryId === null}
              onPress={() => vm.setCategoryId(null)}
            />
          }
          renderItem={({ item: category }) => (
            <CategoryChip
              label={category.name}
              color={category.color ?? colors.primary}
              selected={vm.filters.categoryId === category.id}
              onPress={() => vm.setCategoryId(category.id)}
            />
          )}
        />
        {vm.filters.month ? (
          <View style={styles.chips}>
            <Button
              label="‹"
              variant="secondary"
              onPress={() => vm.shiftMonth(-1)}
              accessibilityLabel={es.transactions.previousMonth}
            />
            <Text style={[typography.body, styles.flex, styles.center, { color: colors.text }]}>
              {formatMonth(vm.filters.month)}
            </Text>
            <Button
              label="›"
              variant="secondary"
              onPress={() => vm.shiftMonth(1)}
              accessibilityLabel={es.transactions.nextMonth}
            />
            <Button
              label={es.transactions.allMonths}
              variant="secondary"
              onPress={() => vm.setMonth(null)}
            />
          </View>
        ) : (
          <Button label={es.transactions.thisMonth} variant="secondary" onPress={vm.thisMonth} />
        )}
        <View
          accessible
          accessibilityRole="summary"
          style={[
            styles.summary,
            cardElevation,
            { backgroundColor: colors.surface, borderRadius: radii.card, padding: spacing.lg },
          ]}
        >
          <View style={styles.flex}>
            <Text style={[typography.bodyMedium, { color: colors.text }]}>
              {vm.filters.month ? formatMonth(vm.filters.month) : es.transactions.allMonths}
            </Text>
            <Text style={[typography.secondary, { color: colors.textMuted }]}>
              {es.transactions.movementsCount(vm.summary.count)}
            </Text>
          </View>
          {vm.summary.currency && vm.summary.complete ? (
            <View style={styles.net}>
              <Text style={[typography.label, { color: colors.textMuted }]}>
                {es.transactions.netBalance.toUpperCase()}
              </Text>
              <Text
                style={[
                  typography.title2,
                  { color: vm.summary.netMinor >= 0 ? colors.income : colors.expense },
                ]}
              >
                {formatMoney(vm.summary.netMinor, vm.summary.currency, LOCALE)}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {vm.deleteError ? (
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Banner message={es.recoverableError} variant="error" />
        </View>
      ) : null}

      <FlatList
        data={vm.items}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        ListEmptyComponent={empty}
        onEndReached={() => void vm.loadMore()}
        onEndReachedThreshold={0.5}
        initialNumToRender={15}
        windowSize={7}
        keyboardShouldPersistTaps="handled"
        ListFooterComponent={
          vm.loadingMore ? (
            <Text
              style={[
                typography.secondary,
                styles.center,
                { color: colors.textMuted, padding: spacing.md },
              ]}
            >
              {es.transactions.loadingMore}
            </Text>
          ) : undefined
        }
      />

      {vm.undoVisible ? (
        <View style={{ padding: spacing.lg }}>
          <Banner
            message={es.transactions.deleted}
            variant="info"
            actionLabel={es.transactions.undo}
            onAction={vm.undoDelete}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  chips: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  rowWrap: { flexDirection: 'row', alignItems: 'stretch', overflow: 'hidden' },
  // La fila base trae un borde inferior pensado para listas planas.
  rowInner: { marginBottom: -1 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  net: { alignItems: 'flex-end' },
  delete: {
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  field: { minHeight: MIN_TOUCH_TARGET },
  kind: { flex: 1, minHeight: MIN_TOUCH_TARGET, alignItems: 'center', justifyContent: 'center' },
});
