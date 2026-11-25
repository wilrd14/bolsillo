import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { es } from '@/core/strings/es';
import {
  DEFAULT_CURRENCY,
  useCreateTransaction,
} from '@/features/capture/model/use-create-transaction';
import { AmountInput, Banner, Button, CategoryChip, MIN_TOUCH_TARGET, Toast, useTheme } from '@/ui';

const KINDS = [
  { value: 'expense', label: es.capture.kindExpense },
  { value: 'income', label: es.capture.kindIncome },
] as const;

/** Pantalla de captura rápida (Brief §12.2). */
export function CaptureScreen() {
  const theme = useTheme();
  const vm = useCreateTransaction();
  const { colors, spacing, radii, typography } = theme;
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

  if (vm.status === 'loading') {
    return (
      <View style={[styles.flex, styles.center, { backgroundColor: colors.background }]}>
        <Text accessibilityRole="text" style={[typography.body, { color: colors.textMuted }]}>
          {es.loading}
        </Text>
      </View>
    );
  }

  if (vm.status === 'error') {
    return (
      <View style={[styles.flex, { backgroundColor: colors.background, padding: spacing.lg }]}>
        <Banner
          message={es.recoverableError}
          variant="error"
          actionLabel={es.actions.retry}
          onAction={vm.retry}
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
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel={es.capture.kindSwitch}
          style={styles.row}
        >
          {KINDS.map((item) => {
            const selected = vm.kind === item.value;
            return (
              <Pressable
                key={item.value}
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
                  style={[typography.body, { color: selected ? colors.onPrimary : colors.text }]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <AmountInput
          kind={vm.kind}
          valueMinor={vm.amountMinor}
          onChangeMinor={vm.setAmountMinor}
          currency={DEFAULT_CURRENCY}
          label={es.capture.amount}
          autoFocus
        />

        <Text style={[typography.label, { color: colors.textMuted }]}>{es.capture.category}</Text>
        {vm.categories.length === 0 ? (
          <Text style={[typography.secondary, { color: colors.textMuted }]}>
            {es.capture.noCategories}
          </Text>
        ) : (
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
        )}

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
          onPress={vm.save}
          disabled={!vm.canSave}
          loading={vm.saving}
        />
        <Button
          label={es.actions.scanReceipt}
          variant="secondary"
          onPress={() => router.push('/scan')}
        />
      </ScrollView>
      <Toast
        visible={vm.saved}
        message={es.transactionSaved}
        variant="success"
        onDismiss={vm.dismissSaved}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', gap: 8 },
  kind: { flex: 1, minHeight: MIN_TOUCH_TARGET, alignItems: 'center', justifyContent: 'center' },
  field: { minHeight: MIN_TOUCH_TARGET, borderWidth: 1 },
});
