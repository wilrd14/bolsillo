import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatMoney } from '@/core/money';
import { es } from '@/core/strings/es';
import {
  AmountInput,
  Banner,
  Button,
  CategoryChip,
  ConfirmDialog,
  DateField,
  MIN_TOUCH_TARGET,
  useTheme,
} from '@/ui';

import { useReceiptReview } from '../model/use-receipt-review';

const LOCALE = 'es-DO';

export interface ReceiptReviewScreenProps {
  readonly id: string;
}

/** Revisión editable de una factura leída (Brief §12.4): guardar crea el gasto con la foto. */
export function ReceiptReviewScreen({ id }: ReceiptReviewScreenProps) {
  const { colors, spacing, radii, typography, cardElevation } = useTheme();
  const insets = useSafeAreaInsets();
  const vm = useReceiptReview(id);
  const [confirming, setConfirming] = useState(false);
  const { done } = vm;

  useEffect(() => {
    if (done) router.back();
  }, [done]);

  const card = [
    cardElevation,
    { backgroundColor: colors.surface, borderRadius: radii.card, padding: spacing.lg },
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

  if (vm.status !== 'ready' || !vm.extraction) {
    const message =
      vm.status === 'missing'
        ? es.scan.notReady
        : vm.status === 'invalid'
          ? es.scan.invalidData
          : es.recoverableError;
    return (
      <View style={[styles.flex, { backgroundColor: colors.background, padding: spacing.lg }]}>
        <Banner
          message={message}
          variant="error"
          actionLabel={vm.status === 'error' ? es.actions.retry : undefined}
          onAction={vm.status === 'error' ? vm.retry : undefined}
        />
        {vm.status === 'invalid' ? (
          <Button
            label={es.scan.discard}
            variant="secondary"
            onPress={() => setConfirming(true)}
            style={{ marginTop: spacing.md }}
          />
        ) : null}
        {confirming ? (
          <DiscardDialog onCancel={() => setConfirming(false)} onConfirm={vm.discard} />
        ) : null}
      </View>
    );
  }

  const { extraction } = vm;
  const flag = (on: boolean) =>
    on ? (
      <Text style={[typography.label, { color: colors.warning }]}>{es.scan.lowConfidence}</Text>
    ) : null;
  const inputStyle = [
    typography.body,
    styles.field,
    { color: colors.text, backgroundColor: colors.background, borderRadius: radii.input },
    { paddingHorizontal: spacing.md },
  ];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.flex, { backgroundColor: colors.background }]}
    >
      <ScrollView
        style={styles.flex}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
      >
        {vm.localUri ? (
          <Image
            source={{ uri: vm.localUri }}
            accessibilityLabel={es.scan.photo}
            resizeMode="cover"
            style={[styles.photo, { borderRadius: radii.card, backgroundColor: colors.surfaceAlt }]}
          />
        ) : null}

        <View style={[card, { gap: spacing.sm }]}>
          <Text style={[typography.label, { color: colors.textMuted }]}>
            {es.scan.total.toUpperCase()}
          </Text>
          <AmountInput
            kind="expense"
            valueMinor={vm.totalMinor}
            onChangeMinor={vm.setTotalMinor}
            currency={extraction.currency}
            locale={LOCALE}
            label={es.scan.total}
            showPreview={false}
          />
          {flag(vm.lowConfidence.total)}
          {vm.totalMinor <= 0 ? (
            <Text
              accessibilityRole="alert"
              style={[typography.secondary, { color: colors.danger }]}
            >
              {es.scan.totalRequired}
            </Text>
          ) : null}
          <View style={[styles.row, { gap: spacing.lg }]}>
            <Text style={[typography.secondary, { color: colors.textMuted }]}>
              {`${es.scan.currency}: ${extraction.currency}`}
            </Text>
            <Text style={[typography.secondary, { color: colors.textMuted }]}>
              {`${es.scan.tax}: ${formatMoney(extraction.tax_minor, extraction.currency, LOCALE)}`}
            </Text>
          </View>
        </View>

        <View style={[card, { gap: spacing.sm }]}>
          <Text style={[typography.label, { color: colors.textMuted }]}>
            {es.scan.merchant.toUpperCase()}
          </Text>
          <TextInput
            value={vm.merchant}
            onChangeText={vm.setMerchant}
            placeholder={es.scan.merchant}
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={es.scan.merchant}
            style={inputStyle}
          />
          {flag(vm.lowConfidence.merchant)}
          <DateField label={es.capture.dateLabel} value={vm.date} onChange={vm.setDate} />
          {flag(vm.lowConfidence.date)}
        </View>

        <View style={[card, { gap: spacing.sm }]}>
          <Text style={[typography.label, { color: colors.textMuted }]}>
            {es.capture.category.toUpperCase()}
          </Text>
          {vm.categories.length === 0 ? (
            <Text style={[typography.secondary, { color: colors.textMuted }]}>
              {es.scan.noCategory}
            </Text>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ gap: spacing.sm }}
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
          )}
        </View>

        {extraction.items.length > 0 ? (
          <View style={[card, { gap: spacing.sm }]}>
            <Text accessibilityRole="header" style={[typography.title2, { color: colors.text }]}>
              {es.scan.items}
            </Text>
            <Text style={[typography.secondary, { color: colors.textMuted }]}>
              {es.scan.itemsCount(extraction.items.length)}
            </Text>
            {extraction.items.map((item, index) => (
              <View key={`${index}-${item.description}`} style={styles.item}>
                <Text style={[typography.body, styles.itemName, { color: colors.text }]}>
                  {item.description}
                </Text>
                <Text style={[typography.bodyMedium, { color: colors.text }]}>
                  {formatMoney(item.amount_minor, extraction.currency, LOCALE)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

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
          label={es.scan.discard}
          variant="secondary"
          onPress={() => setConfirming(true)}
          disabled={vm.saving}
          style={[styles.flex, { borderColor: colors.danger }]}
        />
        <Button
          label={es.scan.save}
          onPress={() => void vm.save()}
          disabled={!vm.canSave}
          loading={vm.saving}
          style={styles.flex}
        />
      </View>
      {confirming ? (
        <DiscardDialog onCancel={() => setConfirming(false)} onConfirm={vm.discard} />
      ) : null}
    </KeyboardAvoidingView>
  );
}

function DiscardDialog({
  onCancel,
  onConfirm,
}: {
  readonly onCancel: () => void;
  readonly onConfirm: () => Promise<void>;
}) {
  return (
    <ConfirmDialog
      visible
      title={es.scan.discardTitle}
      message={es.scan.discardMessage}
      confirmLabel={es.scan.discard}
      cancelLabel={es.scan.keep}
      variant="destructive"
      onCancel={onCancel}
      onConfirm={() => {
        onCancel();
        void onConfirm();
      }}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  photo: { width: '100%', height: 160 },
  field: { minHeight: MIN_TOUCH_TARGET },
  item: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, minHeight: 32 },
  itemName: { flex: 1 },
  actions: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth },
});
