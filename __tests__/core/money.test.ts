import { formatMoney, parseMoney, percentage, sumMoney } from '@/core/money';

describe('dinero en unidad menor', () => {
  it('convierte texto sin perder precisión y respeta la moneda y la región', () => {
    expect(parseMoney('0', 'USD', 'en-US')).toBe(0);
    expect(parseMoney('0,01', 'EUR', 'es-ES')).toBe(1);
    expect(parseMoney('-1.2', 'USD', 'en-US')).toBe(-120);
    expect(parseMoney('90071992547409.91', 'USD', 'en-US')).toBe(Number.MAX_SAFE_INTEGER);
    expect(parseMoney('1', 'JPY', 'ja-JP')).toBe(1);
    expect(parseMoney('0.001', 'KWD', 'en-US')).toBe(1);
  });

  it.each(['', '1e2', '1,200', '1.001', '90071992547409.92'])(
    'rechaza un importe inválido: %s',
    (text) => {
      expect(() => parseMoney(text, 'USD', 'en-US')).toThrow(RangeError);
    },
  );

  it('formatea el signo, los separadores y los importes grandes exactamente', () => {
    expect(formatMoney(-1, 'USD', 'en-US')).toBe('-$0.01');
    expect(formatMoney(123456, 'EUR', 'de-DE')).toBe('1.234,56\u00a0€');
    expect(formatMoney(Number.MAX_SAFE_INTEGER, 'USD', 'en-US')).toBe('$90,071,992,547,409.91');
    expect(formatMoney(1, 'JPY', 'ja-JP')).toBe('￥1');
    expect(() => formatMoney(1.5, 'USD', 'en-US')).toThrow(RangeError);
  });

  it('suma enteros de forma exacta y detecta desbordamientos', () => {
    expect(sumMoney([])).toBe(0);
    expect(sumMoney([Number.MAX_SAFE_INTEGER, 1, -1])).toBe(Number.MAX_SAFE_INTEGER);
    expect(() => sumMoney([Number.MAX_SAFE_INTEGER, 1])).toThrow(RangeError);
    expect(() => sumMoney([1, NaN])).toThrow(RangeError);
  });

  it('redondea el porcentaje al entero más próximo', () => {
    expect(percentage(0, 8)).toBe(0);
    expect(percentage(1, 8)).toBe(13);
    expect(percentage(-1, 8)).toBe(-13);
    expect(percentage(1, 3)).toBe(33);
    expect(percentage(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)).toBe(100);
    expect(() => percentage(1, 0)).toThrow(RangeError);
    expect(() => percentage(Number.MAX_SAFE_INTEGER, 1)).toThrow(RangeError);
  });
});

describe('integridad de importes en unidad menor (RNF-09)', () => {
  it('rechaza sumas con importes que no son enteros seguros', () => {
    expect(() => sumMoney([1.5])).toThrow(RangeError);
    expect(() => sumMoney([100, -0.5])).toThrow(RangeError);
  });

  it('acepta cero, negativos y el límite superior sin perder precisión', () => {
    expect(sumMoney([0, -100, 100])).toBe(0);
    expect(sumMoney([Number.MAX_SAFE_INTEGER, -1])).toBe(Number.MAX_SAFE_INTEGER - 1);
    expect(formatMoney(0, 'USD', 'en-US')).toBe('$0.00');
    expect(parseMoney('+5', 'USD', 'en-US')).toBe(500);
  });
});
