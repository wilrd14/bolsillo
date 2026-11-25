import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatDisplayDate, fromDateKey, toLocalDateKey } from '@/core/dates';
import { es } from '@/core/strings/es';
import { Button } from '@/ui/Button';
import { MIN_TOUCH_TARGET } from '@/ui/theme';
import { useTheme } from '@/ui/use-theme';

export interface DateFieldProps {
  /** AAAA-MM-DD */
  readonly value: string;
  readonly onChange: (dateKey: string) => void;
  readonly label: string;
  readonly testID?: string;
}

/** Selector de fecha con calendario nativo; no permite fechas futuras. Entrega AAAA-MM-DD. */
export function DateField({ value, onChange, label, testID }: DateFieldProps) {
  const { mode, colors, spacing, radii, typography, cardElevation } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(() => fromDateKey(value));

  const endOfToday = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  };
  const current = () => (value ? fromDateKey(value) : new Date());

  const press = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: current(),
        mode: 'date',
        maximumDate: endOfToday(),
        onValueChange: (_event, date) => onChange(toLocalDateKey(date)),
      });
      return;
    }
    setDraft(current());
    setOpen(true);
  };

  return (
    <>
      <Pressable
        onPress={press}
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${formatDisplayDate(value)}`}
        style={styles.field}
      >
        <Text style={[typography.label, { color: colors.textMuted }]}>{label}</Text>
        <Text style={[typography.bodyMedium, { color: colors.text }]}>
          {formatDisplayDate(value)}
        </Text>
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={[styles.backdrop, { backgroundColor: colors.backdrop }]}>
          <View
            accessibilityViewIsModal
            style={[
              cardElevation,
              {
                backgroundColor: colors.surface,
                borderTopLeftRadius: radii.xl,
                borderTopRightRadius: radii.xl,
                padding: spacing.lg,
                paddingBottom: spacing.lg + insets.bottom,
                gap: spacing.md,
              },
            ]}
          >
            <DateTimePicker
              value={draft}
              mode="date"
              display="inline"
              maximumDate={endOfToday()}
              themeVariant={mode}
              onValueChange={(_event, date) => setDraft(date)}
            />
            <View style={[styles.actions, { gap: spacing.sm }]}>
              <Button
                label={es.actions.cancel}
                variant="secondary"
                onPress={() => setOpen(false)}
              />
              <Button
                label={es.actions.accept}
                onPress={() => {
                  onChange(toLocalDateKey(draft));
                  setOpen(false);
                }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: { minHeight: MIN_TOUCH_TARGET, justifyContent: 'center' },
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end' },
});
