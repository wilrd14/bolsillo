import { applyKey, entryToMinor } from '@/features/capture/ui/AmountKeypad';

const press = (keys: Parameters<typeof applyKey>[1][], currency = 'DOP') =>
  keys.reduce((entry, key) => applyKey(entry, key, currency, 'es-DO'), '');

it('builds an amount with the locale decimal separator and limits decimals', () => {
  const sep = applyKey('1', 'decimal', 'DOP', 'es-DO').slice(1);
  expect(press(['1', '2', 'decimal', '5'])).toBe(`12${sep}5`);
  expect(entryToMinor(press(['1', '2', 'decimal', '5']), 'DOP', 'es-DO')).toBe(1250);
  expect(press(['1', 'decimal', '2', '3', '4'])).toBe(`1${sep}23`);
});

it('ignores a second separator, strips leading zeros and deletes', () => {
  expect(press(['0', '0', '7'])).toBe('7');
  expect(press(['1', 'decimal', 'decimal'])).toBe(applyKey('1', 'decimal', 'DOP', 'es-DO'));
  expect(press(['1', '2', 'delete', 'delete', 'delete'])).toBe('');
});

it('rejects the separator for currencies without decimals', () => {
  expect(press(['5', 'decimal'], 'JPY')).toBe('5');
});
