import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { decimalSeparator, formatMoney, parseMoney } from '@/core/money';
import { MIN_TOUCH_TARGET } from '@/ui/theme';
import { useTheme } from '@/ui/use-theme';

export type AmountKind = 'expense' | 'income';

export interface AmountInputProps {
  readonly kind: AmountKind;
  readonly valueMinor: number;
  readonly onChangeMinor: (amountMinor: number) => void;
  readonly currency: string;
  readonly locale?: string;
  readonly label?: string;
  readonly placeholder?: string;
  readonly accessibilityLabel?: string;
  readonly autoFocus?: boolean;
  readonly editable?: boolean;
  /** false oculta la vista previa formateada (cuando el importe ya se muestra aparte). */
  readonly showPreview?: boolean;
  readonly testID?: string;
}

function formatEditableMinor(amountMinor: number, currency: string, locale: string): string {
  if (amountMinor === 0) {
    return '';
  }
  const { maximumFractionDigits = 0 } = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).resolvedOptions();
  if (maximumFractionDigits === 0) {
    return String(amountMinor);
  }
  const scale = 10 ** maximumFractionDigits;
  const whole = Math.trunc(amountMinor / scale);
  const fraction = Math.abs(amountMinor % scale);
  if (fraction === 0) {
    return String(whole);
  }
  const sep = decimalSeparator(locale);
  const padded = String(fraction).padStart(maximumFractionDigits, '0').replace(/0+$/, '');
  return `${whole}${sep}${padded}`;
}

function tryParseInput(
  rawText: string,
  currency: string,
  locale: string,
): { valid: boolean; minor: number; normalized: string } {
  const trimmed = rawText.trim();
  if (trimmed === '') {
    return { valid: true, minor: 0, normalized: '' };
  }
  const sep = decimalSeparator(locale);
  const normalized = trimmed.replace(/[.,]/g, sep);
  const safeText = normalized.endsWith(sep) ? `${normalized}0` : normalized;
  try {
    const minor = parseMoney(safeText, currency, locale);
    return minor >= 0 ? { valid: true, minor, normalized } : { valid: false, minor: 0, normalized };
  } catch {
    return { valid: false, minor: 0, normalized };
  }
}

/** Campo numérico para capturar importes en unidades menores con vista en vivo. */
export function AmountInput(props: AmountInputProps) {
  const { kind, valueMinor, onChangeMinor, currency, locale = 'es-DO', label } = props;
  const theme = useTheme();
  const [rawText, setRawText] = useState<string | null>(null);

  const formattedValue = formatEditableMinor(valueMinor, currency, locale);
  const displayText =
    rawText !== null && tryParseInput(rawText, currency, locale).minor === valueMinor
      ? rawText
      : formattedValue;

  const sign = kind === 'expense' ? '-' : '+';
  const accentColor = kind === 'expense' ? theme.colors.expense : theme.colors.income;
  const formattedPreview = `${sign}${formatMoney(valueMinor, currency, locale)}`;
  const rowStyle = [
    styles.inputRow,
    {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.input,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
  ];

  function handleChangeText(nextText: string) {
    const parsed = tryParseInput(nextText, currency, locale);
    if (!parsed.valid) return;
    setRawText(parsed.normalized);
    onChangeMinor(parsed.minor);
  }

  return (
    <View style={styles.wrapper}>
      {label ? (
        <Text style={[theme.typography.label, { color: theme.colors.textMuted }]}>{label}</Text>
      ) : null}
      <View style={rowStyle}>
        <Text style={[theme.typography.amountLarge, { color: accentColor }]}>{sign}</Text>
        <TextInput
          testID={props.testID}
          value={displayText}
          onChangeText={handleChangeText}
          onBlur={() => setRawText(null)}
          keyboardType="decimal-pad"
          placeholder={props.placeholder ?? '0.00'}
          placeholderTextColor={theme.colors.textMuted}
          autoFocus={props.autoFocus ?? false}
          editable={props.editable ?? true}
          accessibilityLabel={props.accessibilityLabel ?? label ?? formattedPreview}
          style={[styles.input, theme.typography.amountLarge, { color: accentColor }]}
        />
      </View>
      {props.showPreview === false ? null : (
        <Text
          accessibilityRole="text"
          style={[theme.typography.secondary, { color: theme.colors.textMuted }]}
        >
          {formattedPreview}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 4,
  },
  inputRow: {
    minHeight: MIN_TOUCH_TARGET,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET,
    padding: 0,
  },
});
