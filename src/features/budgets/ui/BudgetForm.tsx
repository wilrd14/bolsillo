import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { es } from '@/core/strings/es';
import type { CategoryRow } from '@/features/categories';
import { AmountInput, Banner, Button, CategoryChip, useTheme } from '@/ui';
import { DEFAULT_CURRENCY, LOCALE, type BudgetDraft } from '../model/use-budgets';

export interface BudgetFormProps {
  readonly visible: boolean;
  /** Valores del presupuesto a editar; null para un alta nueva. */
  readonly initial: BudgetDraft | null;
  readonly categories: readonly CategoryRow[];
  readonly saveError: boolean;
  readonly onSave: (draft: BudgetDraft) => void;
  readonly onCancel: () => void;
}

/** Formulario de alta y edición de presupuesto: categoría y límite mensual. */
export function BudgetForm({
  visible,
  initial,
  categories,
  saveError,
  onSave,
  onCancel,
}: BudgetFormProps) {
  const theme = useTheme();
  const { spacing } = theme;
  const insets = useSafeAreaInsets();
  // El padre remonta el formulario con key al abrirlo: los estados se inicializan aquí.
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? '');
  const [limitMinor, setLimitMinor] = useState(initial?.limit_minor ?? 0);
  const [error, setError] = useState(false);

  const effectiveCategoryId = categoryId || categories[0]?.id || '';
  const canSave = effectiveCategoryId !== '' && limitMinor > 0;

  const submit = () => {
    if (!canSave) {
      setError(true);
      return;
    }
    setError(false);
    onSave({ category_id: effectiveCategoryId, limit_minor: limitMinor });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        style={[styles.flex, { backgroundColor: theme.colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            padding: spacing.lg,
            paddingTop: spacing.lg + insets.top,
            paddingBottom: spacing.lg + insets.bottom,
            gap: spacing.md,
          }}
        >
          <Text
            accessibilityRole="header"
            style={[theme.typography.title1, { color: theme.colors.text }]}
          >
            {initial ? es.budgets.editTitle : es.budgets.createTitle}
          </Text>
          <Text style={[theme.typography.label, { color: theme.colors.textMuted }]}>
            {es.budgets.categories}
          </Text>
          <View accessibilityRole="radiogroup">
            {categories.map((cat) => {
              const selected = effectiveCategoryId === cat.id;
              return (
                <CategoryChip
                  key={cat.id}
                  label={cat.name}
                  color={cat.color ?? theme.colors.primary}
                  selected={selected}
                  onPress={() => setCategoryId(cat.id)}
                />
              );
            })}
          </View>
          <AmountInput
            kind="expense"
            valueMinor={limitMinor}
            onChangeMinor={setLimitMinor}
            currency={DEFAULT_CURRENCY}
            locale={LOCALE}
            label={es.budgets.limit}
            accessibilityLabel={es.budgets.limit}
            autoFocus
          />
          {error ? (
            <Text
              accessibilityRole="alert"
              style={[theme.typography.label, { color: theme.colors.danger }]}
            >
              {es.budgets.limitRequired}
            </Text>
          ) : null}
          {saveError ? <Banner message={es.errors.VALIDATION} variant="error" /> : null}
          <Button label={es.actions.save} disabled={!canSave} onPress={submit} />
          <Button label={es.categories.cancel} variant="text" onPress={onCancel} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
