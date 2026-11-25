import {
  endOfMonth,
  endOfWeek,
  startOfMonth,
  startOfWeek,
  toDateKey,
  toIsoUtc,
  toMonthKey,
} from '@/core/dates';

it('representa un instante y sus claves de calendario en UTC', () => {
  const date = new Date('2024-02-29T23:30:00-04:00');
  expect(toIsoUtc(date)).toBe('2024-03-01T03:30:00.000Z');
  expect(toDateKey(date)).toBe('2024-03-01');
  expect(toMonthKey(date)).toBe('2024-03');
  expect(() => toDateKey(new Date(NaN))).toThrow(RangeError);
  expect(() => toDateKey(new Date('+010000-01-01T00:00:00.000Z'))).toThrow(RangeError);
});

it('calcula los extremos inclusivos de un mes bisiesto y de diciembre', () => {
  const date = new Date('2024-02-14T14:20:00Z');
  expect(startOfMonth(date)).toBe('2024-02-01');
  expect(endOfMonth(date)).toBe('2024-02-29');
  expect(endOfMonth(new Date('2023-02-14'))).toBe('2023-02-28');
  expect(endOfMonth(new Date('2024-12-03'))).toBe('2024-12-31');
  expect(toIsoUtc(date)).toBe('2024-02-14T14:20:00.000Z');
});

it('calcula la semana de lunes a domingo aunque cambie el año', () => {
  const sunday = new Date('2023-01-01');
  expect(startOfWeek(sunday)).toBe('2022-12-26');
  expect(endOfWeek(sunday)).toBe('2023-01-01');
  expect(startOfWeek(new Date('2024-01-01'))).toBe('2024-01-01');
});
