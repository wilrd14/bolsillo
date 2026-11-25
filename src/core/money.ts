const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

function toInteger(value: bigint): number {
  if (value < -MAX_SAFE || value > MAX_SAFE) {
    throw new RangeError('Money result exceeds the safe integer range');
  }
  return Number(value);
}

function toBigInt(value: number): bigint {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError('Expected a safe integer in minor units');
  }
  return BigInt(value);
}

/** Separador decimal de la región. Hermes no implementa `formatToParts`: se deduce de `format`. */
export function decimalSeparator(locale: string): string {
  const sample = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, useGrouping: false });
  return /1(\D+)1/.exec(sample.format(1.1))?.[1] ?? '.';
}

/** Lee un importe sin agrupación con el separador decimal de la región. */
export function parseMoney(text: string, currency: string, locale: string): number {
  const { maximumFractionDigits = 0 } = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).resolvedOptions();
  const separator = decimalSeparator(locale);
  const [whole, fraction, extra] = text.trim().split(separator);
  if (
    !/^[+-]?\d+$/.test(whole) ||
    extra !== undefined ||
    (fraction !== undefined && (!/^\d+$/.test(fraction) || fraction.length > maximumFractionDigits))
  ) {
    throw new RangeError('Invalid amount');
  }

  const scale = 10n ** BigInt(maximumFractionDigits);
  const minor = BigInt((fraction ?? '').padEnd(maximumFractionDigits, '0'));
  return toInteger(BigInt(whole) * scale + (whole.startsWith('-') ? -minor : minor));
}

/**
 * Formatea el importe conservando los centavos incluso en importes grandes.
 * Usa solo `format` y `resolvedOptions` porque Hermes no implementa `formatToParts`.
 */
export function formatMoney(amountMinor: number, currency: string, locale: string): string {
  const amount = toBigInt(amountMinor);
  const negative = amount < 0n;
  const absolute = negative ? -amount : amount;
  const formatter = new Intl.NumberFormat(locale, { style: 'currency', currency });
  const { maximumFractionDigits = 0 } = formatter.resolvedOptions();
  const scale = 10n ** BigInt(maximumFractionDigits);
  const formatted = formatter.format(Number(absolute / scale));
  const body =
    maximumFractionDigits === 0
      ? formatted
      : // La última racha de dígitos son los decimales (ceros): se sustituyen por los reales.
        formatted.replace(
          new RegExp(String.raw`\d{${maximumFractionDigits}}(?=\D*$)`),
          String(absolute % scale).padStart(maximumFractionDigits, '0'),
        );
  return negative ? `-${body}` : body;
}

/** Suma exactamente y valida que el total se pueda guardar como entero seguro. */
export function sumMoney(amounts: readonly number[]): number {
  return toInteger(amounts.reduce((sum, amount) => sum + toBigInt(amount), 0n));
}

/** Redondea al entero más cercano y aleja los empates de cero. */
export function percentage(partMinor: number, totalMinor: number): number {
  const total = toBigInt(totalMinor);
  if (total <= 0n) {
    throw new RangeError('Percentage requires a positive total');
  }

  const scaled = toBigInt(partMinor) * 100n;
  const adjustment = scaled < 0n ? -(total / 2n) : total / 2n;
  return toInteger((scaled + adjustment) / total);
}
