import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { es } from '@/core/strings/es';
import { Button, useTheme } from '@/ui';

export interface DeleteMovementSheetProps {
  readonly visible: boolean;
  readonly title: string;
  readonly dateLabel: string;
  /** Importe ya formateado y con signo. */
  readonly amountLabel: string;
  readonly amountColor: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

/** Hoja inferior de confirmación de borrado (diseño Pocket Calm). */
export function DeleteMovementSheet(props: DeleteMovementSheetProps) {
  const { colors, spacing, radii, typography, cardElevation } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={props.visible}
      transparent
      animationType="slide"
      onRequestClose={props.onCancel}
    >
      <Pressable
        accessible={false}
        onPress={props.onCancel}
        style={[styles.backdrop, { backgroundColor: colors.backdrop }]}
      />
      <View
        accessibilityViewIsModal
        accessibilityLabel={es.transactions.deleteSheetTitle}
        style={[
          styles.sheet,
          {
            backgroundColor: colors.surface,
            borderTopLeftRadius: radii.xl,
            borderTopRightRadius: radii.xl,
            padding: spacing.xl,
            paddingBottom: spacing.xl + insets.bottom,
            gap: spacing.md,
          },
        ]}
      >
        <Text accessibilityRole="header" style={[typography.title1, { color: colors.text }]}>
          {es.transactions.deleteSheetTitle}
        </Text>
        <Text style={[typography.body, { color: colors.textMuted }]}>
          {es.transactions.deleteSheetMessage}
        </Text>
        <View
          style={[
            cardElevation,
            styles.summary,
            { backgroundColor: colors.background, borderRadius: radii.card, padding: spacing.lg },
          ]}
        >
          <View style={styles.flex}>
            <Text numberOfLines={1} style={[typography.bodyMedium, { color: colors.text }]}>
              {props.title}
            </Text>
            <Text style={[typography.secondary, { color: colors.textMuted }]}>
              {props.dateLabel}
            </Text>
          </View>
          <Text style={[typography.title2, { color: props.amountColor }]}>{props.amountLabel}</Text>
        </View>
        <Button label={es.transactions.deleteForever} variant="danger" onPress={props.onConfirm} />
        <Button label={es.transactions.keepItem} variant="secondary" onPress={props.onCancel} />
        <Text style={[typography.label, styles.note, { color: colors.textMuted }]}>
          {es.transactions.deleteIrreversible}
        </Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1 },
  sheet: { width: '100%' },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  note: { textAlign: 'center' },
});
