import { z } from 'zod';

const confidence = z.number().refine((value) => value >= 0 && value <= 1);
const amount = z.string().refine((value) => /^[+-]?\d{1,16}(?:\.\d{1,4})?$/.test(value));
const currencies = new Set(Intl.supportedValuesOf('currency'));

export const extractionSchema = z.strictObject({
  receipt: z
    .strictObject({
      merchant: z.string().nullable(),
      date: z
        .string()
        .refine((value) => z.iso.date().safeParse(value).success)
        .nullable(),
      total: amount,
      tax: amount,
      currency: z.string().refine((value) => currencies.has(value)),
      items: z.array(z.strictObject({ description: z.string(), amount })),
      confidence: z.strictObject({ merchant: confidence, date: confidence, total: confidence }),
    })
    .nullable(),
});

type Extraction = NonNullable<z.infer<typeof extractionSchema>['receipt']>;

/** Convierte los decimales exactos sin perder precisi?n en importes grandes. */
export function toReceipt({ total, tax, currency, items, ...fields }: Extraction) {
  const digits =
    new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
      .maximumFractionDigits ?? 0;

  function minor(value: string) {
    const [whole, fraction = ''] = value.replace(/^[+-]/, '').split('.');
    if (fraction.length > digits) throw new RangeError('Invalid currency precision');
    const absolute = BigInt(whole + fraction.padEnd(digits, '0'));
    const result = Number(value.startsWith('-') ? -absolute : absolute);
    if (!Number.isSafeInteger(result)) throw new RangeError('Unsafe amount');
    return result;
  }

  return {
    ...fields,
    currency,
    total_minor: minor(total),
    tax_minor: minor(tax),
    items: items.map(({ description, amount }) => ({ description, amount_minor: minor(amount) })),
  };
}
