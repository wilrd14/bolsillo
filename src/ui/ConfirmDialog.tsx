import { Modal, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/ui/Button';
import { useTheme } from '@/ui/use-theme';

export type ConfirmDialogVariant = 'normal' | 'destructive';

export interface ConfirmDialogProps {
  readonly visible: boolean;
  readonly title: string;
  readonly message: string;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
  readonly variant?: ConfirmDialogVariant;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  readonly accessibilityLabel?: string;
  readonly testID?: string;
}

/** Diálogo modal de confirmación para acciones normales o irreversibles. */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant = 'normal',
  onConfirm,
  onCancel,
  accessibilityLabel,
  testID,
}: ConfirmDialogProps) {
  const theme = useTheme();
  const confirmVariant = variant === 'destructive' ? 'danger' : 'primary';

  return (
    <Modal
      testID={testID}
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={[styles.backdrop, { backgroundColor: theme.colors.backdrop }]}>
        <View
          accessible
          accessibilityViewIsModal
          accessibilityRole="alert"
          accessibilityLabel={accessibilityLabel ?? title}
          style={[
            styles.dialog,
            theme.cardElevation,
            {
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radii.xl,
              padding: theme.spacing.xl,
              gap: theme.spacing.md,
            },
          ]}
        >
          <Text style={[theme.typography.title2, { color: theme.colors.text }]}>{title}</Text>
          <Text style={[theme.typography.body, { color: theme.colors.textMuted }]}>{message}</Text>
          <View style={[styles.actions, { gap: theme.spacing.sm }]}>
            <Button label={cancelLabel} onPress={onCancel} variant="secondary" />
            <Button label={confirmLabel} onPress={onConfirm} variant={confirmVariant} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dialog: {
    width: '100%',
    maxWidth: 400,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
});
