import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { es } from '@/core/strings/es';
import { useTransactionDetail } from '@/features/transactions/model/use-transaction-detail';
import {
  AmountInput,
  Banner,
  Button,
  CategoryChip,
  ConfirmDialog,
  MIN_TOUCH_TARGET,
  useTheme,
} from '@/ui';

export interface TransactionDetailScreenProps {
  readonly id: string;
}

/** Detalle y edición de un movimiento (Brief §12.5). */
export function TransactionDetailScreen({ id }: TransactionDetailScreenProps) {
  const { colors, spacing, radii, typography } = useTheme();
  const vm = useTransactionDetail(id);
  const [confirming, setConfirming] = useState(false);
  const { done } = vm;

  useEffect(() => {
    if (done) router.back();
  }, [done]);

  const inputStyle = [
    typography.body,
    styles.field,
    {
      color: colors.text,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.input,
      paddingHorizontal: spacing.md,
    },
  ];
  const back = <Button label={es.transactions.back} variant="text" onPress={() => router.back()} />;

  if (vm.status === 'loading') {
    return (
      <View style={[styles.flex, styles.center, { backgroundColor: colors.background }]}>
        <Text accessibilityRole="text" style={[typography.body, { color: colors.textMuted }]}>
          {es.loading}
        </Text>
      </View>
    );
  }

  if (vm.status === 'error' || vm.status === 'missing') {
    return (
      <View
        style={[
          styles.flex,
          { backgroundColor: colors.background, padding: spacing.lg, gap: spacing.md },
        ]}
      >
        {back}
        <Banner
          message={vm.status === 'missing' ? es.transactions.notFound : es.recoverableError}
          variant="error"
          actionLabel={vm.status === 'error' ? es.actions.retry : undefined}
          onAction={vm.status === 'error' ? vm.retry : undefined}
        />
      </View>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
      >
        {back}
        <Text accessibilityRole="header" style={[typography.title1, { color: colors.text }]}>
          {es.transactions.detailTitle}
        </Text>

        <AmountInput
          kind={vm.kind}
          valueMinor={vm.amountMinor}
          onChangeMinor={vm.setAmountMinor}
          currency={vm.currency}
          label={es.capture.amount}
        />

        <Text style={[typography.label, { color: colors.textMuted }]}>{es.capture.category}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.sm }}
        >
          {vm.categories.map((category) => (
            <CategoryChip
              key={category.id}
              label={category.name}
              color={category.color ?? colors.primary}
              selected={vm.categoryId === category.id}
              onPress={() => vm.setCategoryId(category.id)}
            />
          ))}
        </ScrollView>

        <TextInput
          value={vm.merchant}
          onChangeText={vm.setMerchant}
          placeholder={es.transactions.merchant}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={es.transactions.merchant}
          style={inputStyle}
        />
        <TextInput
          value={vm.note}
          onChangeText={vm.setNote}
          placeholder={es.capture.note}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={es.capture.note}
          style={inputStyle}
        />
        <TextInput
          value={vm.date}
          onChangeText={vm.setDate}
          placeholder={es.capture.date}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={es.capture.date}
          autoCapitalize="none"
          style={inputStyle}
        />

        {vm.error ? <Banner message={vm.error} variant="error" /> : null}

        <Button
          label={es.actions.save}
          onPress={() => void vm.save()}
          disabled={!vm.canSave}
          loading={vm.saving}
        />
        <Button
          label={es.transactions.deleteItem}
          variant="danger"
          onPress={() => setConfirming(true)}
          disabled={vm.saving}
        />
      </ScrollView>
      <ConfirmDialog
        visible={confirming}
        title={es.transactions.confirmDeleteTitle}
        message={es.transactions.confirmDeleteMessage}
        confirmLabel={es.transactions.deleteItem}
        cancelLabel={es.transactions.cancel}
        variant="destructive"
        onConfirm={() => {
          setConfirming(false);
          void vm.remove();
        }}
        onCancel={() => setConfirming(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  field: { minHeight: MIN_TOUCH_TARGET, borderWidth: 1 },
});
