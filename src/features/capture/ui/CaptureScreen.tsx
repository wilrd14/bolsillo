import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { formatMoney } from '@/core/money';
import { es } from '@/core/strings/es';
import {
  DEFAULT_CURRENCY,
  useCreateTransaction,
} from '@/features/capture/model/use-create-transaction';
import {
  AmountDisplay,
  AmountKeypad,
  applyKey,
  entryToMinor,
  type KeypadKey,
} from '@/features/capture/ui/AmountKeypad';
import { Banner, Button, CategoryChip, DateField, MIN_TOUCH_TARGET, Toast, useTheme } from '@/ui';

const KINDS = [
  { value: 'expense', label: es.capture.kindExpense },
  { value: 'income', label: es.capture.kindIncome },
] as const;

const LOCALE = 'es-DO';

/** Pantalla de captura rápida (Brief §12.2) con teclado numérico propio. */
export function CaptureScreen() {
  const theme = useTheme();
  const vm = useCreateTransaction();
  const [typed, setTyped] = useState('');
  const { colors, spacing, radii, typography, cardElevation } = theme;
  const cardStyle = [
    cardElevation,
    { backgroundColor: colors.surface, borderRadius: radii.card, padding: spacing.md },
  ];

  // Tras guardar el monto vuelve a 0: el texto tecleado deja de coincidir y se vacía.
  const entry = entryToMinor(typed, DEFAULT_CURRENCY, LOCALE) === vm.amountMinor ? typed : '';
  const pressKey = (key: KeypadKey) => {
    const next = applyKey(entry, key, DEFAULT_CURRENCY, LOCALE);
    setTyped(next);
    vm.setAmountMinor(entryToMinor(next, DEFAULT_CURRENCY, LOCALE));
  };

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
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
      >
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel={es.capture.kindSwitch}
          style={[
            styles.row,
            { backgroundColor: colors.surfaceAlt, borderRadius: radii.pill, padding: spacing.xs },
          ]}
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
                    backgroundColor: selected ? colors.primary : 'transparent',
                  },
                ]}
              >
                <Text
                  style={[
                    typography.bodyMedium,
                    { color: selected ? colors.onPrimary : colors.textMuted },
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <AmountDisplay
          kind={vm.kind}
          entry={entry}
          currency={DEFAULT_CURRENCY}
          spokenAmount={formatMoney(vm.amountMinor, DEFAULT_CURRENCY, LOCALE)}
        />

        <Text style={[typography.label, { color: colors.textMuted }]}>
          {es.capture.category.toUpperCase()}
        </Text>
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
          style={[typography.body, styles.field, cardStyle, { color: colors.text }]}
        />

        <View style={[styles.row, { gap: spacing.sm }]}>
          <View style={[styles.flex, cardStyle]}>
            <DateField label={es.capture.dateLabel} value={vm.date} onChange={vm.setDate} />
          </View>
          <Pressable
            onPress={() => router.push('/scan')}
            accessibilityRole="button"
            accessibilityLabel={es.actions.scanReceipt}
            style={({ pressed }) => [
              styles.flex,
              styles.scan,
              {
                backgroundColor: colors.surfaceAlt,
                borderRadius: radii.card,
                padding: spacing.md,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Text style={[typography.bodyMedium, { color: colors.primary }]}>
              {es.actions.scanReceipt}
            </Text>
            <Text style={[typography.label, { color: colors.textMuted }]}>
              {es.capture.scanHint}
            </Text>
          </Pressable>
        </View>

        <AmountKeypad currency={DEFAULT_CURRENCY} locale={LOCALE} onKey={pressKey} />

        {vm.error ? <Banner message={vm.error} variant="error" /> : null}

        <Button
          label={es.actions.save}
          onPress={vm.save}
          disabled={!vm.canSave}
          loading={vm.saving}
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
  row: { flexDirection: 'row' },
  kind: { flex: 1, minHeight: MIN_TOUCH_TARGET, alignItems: 'center', justifyContent: 'center' },
  field: { minHeight: MIN_TOUCH_TARGET },
  scan: { justifyContent: 'center', gap: 2, minHeight: MIN_TOUCH_TARGET },
});
