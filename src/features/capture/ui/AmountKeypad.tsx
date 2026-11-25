import { Pressable, StyleSheet, Text, View } from 'react-native';

import { decimalSeparator, parseMoney } from '@/core/money';
import { es } from '@/core/strings/es';
import { FONT_FAMILY, MIN_TOUCH_TARGET, useTheme } from '@/ui';

export type KeypadKey = 'decimal' | 'delete' | `${number}`;

const MAX_ENTRY_LENGTH = 12;

/** Importe en unidades menores de un texto tecleado ("12," cuenta como "12,0"). */
export function entryToMinor(entry: string, currency: string, locale: string): number {
  if (entry === '') return 0;
  const sep = decimalSeparator(locale);
  return parseMoney(entry.endsWith(sep) ? `${entry}0` : entry, currency, locale);
}

/** Aplica una tecla al texto tecleado; devuelve el mismo texto si la tecla no es válida. */
export function applyKey(entry: string, key: KeypadKey, currency: string, locale: string): string {
  const sep = decimalSeparator(locale);
  let next = entry;
  if (key === 'delete') {
    next = entry.slice(0, -1);
  } else if (key === 'decimal') {
    if (entry.includes(sep)) return entry;
    next = `${entry === '' ? '0' : entry}${sep}`;
  } else {
    next = entry === '0' ? key : `${entry}${key}`;
  }
  if (next.length > MAX_ENTRY_LENGTH) return entry;
  try {
    entryToMinor(next, currency, locale);
    return next;
  } catch {
    // Demasiados decimales para la moneda o importe fuera de rango.
    return entry;
  }
}

export interface AmountKeypadProps {
  readonly currency: string;
  readonly locale: string;
  readonly onKey: (key: KeypadKey) => void;
}

const DIGIT_ROWS: readonly (readonly KeypadKey[])[] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
];

/** Teclado numérico propio: no abre el teclado del sistema. */
export function AmountKeypad({ currency, locale, onKey }: AmountKeypadProps) {
  const { colors, spacing, radii, typography, cardElevation } = useTheme();
  const sep = decimalSeparator(locale);
  const { maximumFractionDigits = 0 } = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).resolvedOptions();

  const key = (value: KeypadKey, label: string, a11y: string, accent = false) => (
    <Pressable
      key={value}
      onPress={() => onKey(value)}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => [
        styles.key,
        accent ? null : cardElevation,
        {
          backgroundColor: accent ? colors.surfaceAlt : colors.surface,
          borderRadius: radii.md,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Text style={[typography.title1, { color: colors.text }]}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={{ gap: spacing.sm }}>
      {DIGIT_ROWS.map((row) => (
        <View key={row.join('')} style={[styles.row, { gap: spacing.sm }]}>
          {row.map((digit) => key(digit, digit, `${es.capture.keypadKey} ${digit}`))}
        </View>
      ))}
      <View style={[styles.row, { gap: spacing.sm }]}>
        {maximumFractionDigits > 0 ? (
          key('decimal', sep, es.capture.keypadDecimal, true)
        ) : (
          <View style={styles.key} />
        )}
        {key('0', '0', `${es.capture.keypadKey} 0`)}
        {key('delete', '⌫', es.capture.keypadDelete, true)}
      </View>
    </View>
  );
}

/** Importe grande con signo y moneda, sin campo de texto editable. */
export function AmountDisplay(props: {
  readonly kind: 'expense' | 'income';
  readonly entry: string;
  readonly currency: string;
  readonly spokenAmount: string;
}) {
  const { colors, spacing, radii, typography, cardElevation } = useTheme();
  const color = props.kind === 'expense' ? colors.expense : colors.income;
  const sign = props.kind === 'expense' ? '-' : '+';
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${es.capture.amount}: ${props.spokenAmount}`}
      style={[
        cardElevation,
        styles.display,
        { backgroundColor: colors.surface, borderRadius: radii.card, padding: spacing.xl },
      ]}
    >
      <Text style={[typography.amountLarge, { color }]}>
        {sign} {props.entry === '' ? '0' : props.entry}
        <Text style={[typography.title2, { fontFamily: FONT_FAMILY.bold }]}> {props.currency}</Text>
      </Text>
      <Text style={[typography.secondary, { color: colors.textMuted }]}>
        {es.capture.amountHint}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  key: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET + 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  display: { alignItems: 'center', gap: 4 },
});
