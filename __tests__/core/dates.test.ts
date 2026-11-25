import {
  endOfMonth,
  endOfWeek,
  startOfMonth,
  startOfWeek,
  toDateKey,
  toIsoUtc,
  toMonthKey,
} from '@/core/dates';
import * as d from '@/core/dates';

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

describe('fechas de pantalla', () => {
  it('formatea y revierte DD/MM/AAAA', () => {
    expect(d.formatDisplayDate('2026-11-05')).toBe('05/11/2026');
    expect(d.parseDisplayDate('05/11/2026')).toBe('2026-11-05');
    expect(d.parseDisplayDate('2026-11-05')).toBeNull();
    expect(d.formatDisplayMonth('2026-11')).toBe('11/2026');
  });

  it('usa partes locales sin desfase de día', () => {
    expect(d.toLocalDateKey(new Date(2026, 0, 1, 0, 30))).toBe('2026-01-01');
    expect(d.toLocalDateKey(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
    expect(d.toLocalDateKey(d.fromDateKey('2026-03-08'))).toBe('2026-03-08');
  });
});
