import { extractionSchema, toReceipt } from './extraction.ts';

function equal(actual: unknown, expected: unknown) {
  if (!Object.is(actual, expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

function receiptOf(total: string, tax = '0') {
  const result = extractionSchema.parse({
    receipt: {
      merchant: 'Tienda Sintética',
      date: '2026-11-25',
      total,
      tax,
      currency: 'DOP',
      items: [{ description: 'Frutas', amount: total }],
      confidence: { merchant: 1, date: 1, total: 1 },
    },
  });
  if (!result.receipt) throw new Error('Se esperaba una factura');
  return result.receipt;
}

Deno.test('importes con punto se convierten a unidad menor', () => {
  equal(toReceipt(receiptOf('12.34')).total_minor, 1234);
  equal(toReceipt(receiptOf('12.34', '0.01')).tax_minor, 1);
  equal(toReceipt(receiptOf('12345.67', '8.25')).total_minor, 1234567);
  equal(toReceipt(receiptOf('12345.67', '8.25')).tax_minor, 825);
});

Deno.test('importes negativos se convierten a unidad menor', () => {
  equal(toReceipt(receiptOf('-7.50')).total_minor, -750);
});

Deno.test('importes inseguros lanzan RangeError', () => {
  let thrown: unknown;
  try {
    toReceipt(receiptOf('90071992547409.92'));
  } catch (error) {
    thrown = error;
  }
  equal(thrown instanceof RangeError, true);
});

Deno.test('importes con coma no pasan la validación del esquema', () => {
  const result = extractionSchema.safeParse({
    receipt: {
      merchant: null,
      date: null,
      total: '12,34',
      tax: '0,5',
      currency: 'DOP',
      items: [{ description: 'Sin importe', amount: '12,34' }],
      confidence: { merchant: 1, date: 1, total: 1 },
    },
  });
  equal(result.success, false);
});

Deno.test('decimales excesivos no pasan la validación del esquema', () => {
  const result = extractionSchema.safeParse({
    receipt: {
      merchant: null,
      date: null,
      total: '1.23456',
      tax: '0',
      currency: 'DOP',
      items: [{ description: 'Muy decimales', amount: '1.23456' }],
      confidence: { merchant: 1, date: 1, total: 1 },
    },
  });
  equal(result.success, false);
});

Deno.test('campo total ausente no pasa la validación del esquema', () => {
  const result = extractionSchema.safeParse({
    receipt: {
      merchant: 'Tienda sin total',
      date: '2026-11-25',
      tax: '0.01',
      currency: 'DOP',
      items: [{ description: 'Sin importe', amount: '1.00' }],
      confidence: { merchant: 1, date: 1, total: 1 },
    },
  });
  equal(result.success, false);
});
