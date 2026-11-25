import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatDisplayDate } from '@/core/dates';
import { formatMoney } from '@/core/money';
import { es } from '@/core/strings/es';
import { DeleteMovementSheet } from '@/features/transactions/ui/DeleteMovementSheet';
import { useTransactionDetail } from '@/features/transactions/model/use-transaction-detail';
import {
  AmountInput,
  Banner,
  Button,
  CategoryChip,
  DateField,
  MIN_TOUCH_TARGET,
  useTheme,
} from '@/ui';

const LOCALE = 'es-DO';

export interface TransactionDetailScreenProps {
  readonly id: string;
}

type IconName = keyof typeof Ionicons.glyphMap;

/** Detalle y edición de un movimiento (Brief §12.5): barra propia, formulario y acciones fijas. */
export function TransactionDetailScreen({ id }: TransactionDetailScreenProps) {
  const { colors, spacing, radii, typography, cardElevation } = useTheme();
  const insets = useSafeAreaInsets();
  const vm = useTransactionDetail(id);
  const [confirming, setConfirming] = useState(false);
  const [editingAmount, setEditingAmount] = useState(false);
  const { done } = vm;

  useEffect(() => {
    if (done) router.back();
  }, [done]);

  const card = [
    cardElevation,
    { backgroundColor: colors.surface, borderRadius: radii.card, padding: spacing.lg },
  ];
  const inputStyle = [
    typography.body,
    styles.field,
    { color: colors.text, backgroundColor: colors.background, borderRadius: radii.input },
    { paddingHorizontal: spacing.md },
  ];
  const topBar = (
    <Pressable
      onPress={() => router.back()}
      accessibilityRole="button"
      accessibilityLabel={es.transactions.back}
      hitSlop={8}
      style={[styles.back, { marginTop: insets.top, paddingHorizontal: spacing.lg }]}
    >
      <Ionicons name="chevron-back" size={24} color={colors.primary} />
      <Text style={[typography.bodyMedium, { color: colors.primary }]}>{es.transactions.back}</Text>
    </Pressable>
  );

  if (vm.status === 'loading') {
    return (
      <View style={[styles.flex, { backgroundColor: colors.background }]}>
        {topBar}
        <View style={[styles.flex, styles.center]}>
          <Text accessibilityRole="text" style={[typography.body, { color: colors.textMuted }]}>
            {es.loading}
          </Text>
        </View>
      </View>
    );
  }

  if (vm.status === 'error' || vm.status === 'missing') {
    return (
      <View style={[styles.flex, { backgroundColor: colors.background }]}>
        {topBar}
        <View style={{ padding: spacing.lg }}>
          <Banner
            message={vm.status === 'missing' ? es.transactions.notFound : es.recoverableError}
            variant="error"
            actionLabel={vm.status === 'error' ? es.actions.retry : undefined}
            onAction={vm.status === 'error' ? vm.retry : undefined}
          />
        </View>
      </View>
    );
  }

  const isExpense = vm.kind === 'expense';
  const accent = isExpense ? colors.expense : colors.income;
  const sign = isExpense ? '-' : '+';
  const amountLabel = `${sign}${formatMoney(vm.amountMinor, vm.currency, LOCALE)}`;
  const category = vm.categories.find((c) => c.id === vm.categoryId);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.flex, { backgroundColor: colors.background }]}
    >
      {topBar}
      <ScrollView
        style={styles.flex}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
      >
        <Text accessibilityRole="header" style={[typography.title1, { color: colors.text }]}>
          {es.transactions.detailTitle}
        </Text>

        <View style={[card, styles.hero, { gap: spacing.sm }]}>
          <View style={[styles.icon, { backgroundColor: colors.surfaceAlt }]}>
            <Ionicons
              name={(category?.icon ?? 'ellipsis-horizontal') as IconName}
              size={28}
              color={colors.primary}
            />
          </View>
          <Text style={[typography.bodyMedium, { color: colors.text }]}>
            {category?.name ?? es.transactions.uncategorized}
          </Text>
          {editingAmount ? (
            <View style={styles.stretch}>
              <AmountInput
                kind={vm.kind}
                valueMinor={vm.amountMinor}
                onChangeMinor={vm.setAmountMinor}
                currency={vm.currency}
                label={es.capture.amount}
                showPreview={false}
                autoFocus
              />
              <Button
                label={es.transactions.doneEditing}
                variant="text"
                onPress={() => setEditingAmount(false)}
              />
            </View>
          ) : (
            <Pressable
              onPress={() => setEditingAmount(true)}
              accessibilityRole="button"
              accessibilityLabel={`${es.transactions.changeAmount}: ${amountLabel}`}
              style={styles.amountButton}
            >
              <Text
                adjustsFontSizeToFit
                numberOfLines={1}
                style={[typography.amountLarge, styles.amount, { color: accent }]}
              >
                {amountLabel}
              </Text>
            </Pressable>
          )}
          <Text style={[typography.label, { color: accent }]}>
            {(isExpense ? es.capture.kindExpense : es.capture.kindIncome).toUpperCase()}
          </Text>
        </View>

        <View style={[card, { gap: spacing.sm }]}>
          <Text style={[typography.label, { color: colors.textMuted }]}>
            {es.capture.category.toUpperCase()}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            style={{ marginHorizontal: -spacing.lg }}
            contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg }}
          >
            {vm.categories.map((item) => (
              <CategoryChip
                key={item.id}
                label={item.name}
                color={item.color ?? colors.primary}
                selected={vm.categoryId === item.id}
                onPress={() => vm.setCategoryId(item.id)}
              />
            ))}
          </ScrollView>

          <Text style={[typography.label, { color: colors.textMuted }]}>
            {es.transactions.merchant.toUpperCase()}
          </Text>
          <TextInput
            value={vm.merchant}
            onChangeText={vm.setMerchant}
            placeholder={es.transactions.merchant}
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={es.transactions.merchant}
            style={inputStyle}
          />
          <Text style={[typography.label, { color: colors.textMuted }]}>
            {es.capture.note.toUpperCase()}
          </Text>
          <TextInput
            value={vm.note}
            onChangeText={vm.setNote}
            placeholder={es.capture.note}
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={es.capture.note}
            style={inputStyle}
          />
          <DateField label={es.capture.dateLabel} value={vm.date} onChange={vm.setDate} />
        </View>

        {vm.error ? <Banner message={vm.error} variant="error" /> : null}
      </ScrollView>

      <View
        style={[
          styles.actions,
          {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: insets.bottom + spacing.md,
            gap: spacing.sm,
          },
        ]}
      >
        <Button
          label={es.transactions.deleteItem}
          variant="secondary"
          onPress={() => setConfirming(true)}
          disabled={vm.saving}
          style={[styles.flex, { borderColor: colors.danger }]}
        />
        <Button
          label={es.actions.save}
          onPress={() => void vm.save()}
          disabled={!vm.canSave}
          loading={vm.saving}
          style={styles.flex}
        />
      </View>

      <DeleteMovementSheet
        visible={confirming}
        title={vm.merchant || vm.note || es.transactions.detailTitle}
        dateLabel={formatDisplayDate(vm.date)}
        amountLabel={amountLabel}
        amountColor={accent}
        onConfirm={() => {
          setConfirming(false);
          void vm.remove();
        }}
        onCancel={() => setConfirming(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  stretch: { alignSelf: 'stretch' },
  back: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', minHeight: 44 },
  hero: { alignItems: 'center' },
  icon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  amountButton: { minHeight: MIN_TOUCH_TARGET, justifyContent: 'center', alignSelf: 'stretch' },
  amount: { textAlign: 'center' },
  field: { minHeight: MIN_TOUCH_TARGET },
  actions: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth },
});
