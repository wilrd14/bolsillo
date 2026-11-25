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

/** Lee un importe sin agrupación con el separador decimal de la región. */
export function parseMoney(text: string, currency: string, locale: string): number {
  const { maximumFractionDigits = 0 } = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).resolvedOptions();
  const separator = new Intl.NumberFormat(locale, { minimumFractionDigits: 1 })
    .formatToParts(0)
    .find((part) => part.type === 'decimal')!.value;
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

/** Formatea por partes para conservar los centavos incluso en importes grandes. */
export function formatMoney(amountMinor: number, currency: string, locale: string): string {
  const amount = toBigInt(amountMinor);
  const formatter = new Intl.NumberFormat(locale, { style: 'currency', currency });
  const { numberingSystem, maximumFractionDigits = 0 } = formatter.resolvedOptions();
  const scale = 10n ** BigInt(maximumFractionDigits);
  const whole = amount / scale;
  const remainder = amount % scale;
  const fraction = new Intl.NumberFormat(locale, {
    numberingSystem,
    useGrouping: false,
    minimumIntegerDigits: maximumFractionDigits || 1,
  }).format(Number(remainder < 0n ? -remainder : remainder));

  return formatter
    .formatToParts(whole === 0n && amount < 0n ? -0 : Number(whole))
    .map((part) => (part.type === 'fraction' ? fraction : part.value))
    .join('');
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
