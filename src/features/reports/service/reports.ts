import { z } from 'zod';

import { endOfMonth, endOfWeek, startOfMonth, startOfWeek, toDateKey } from '@/core/dates';
import { AppError } from '@/core/errors';
import type { Database } from '@/db/database';
import { withDatabaseAccess } from '@/db/transaction';
import { listCategoryTotals, type CategoryTotal } from '@/features/reports/data/report-repository';

const periodSchema = z.object({ period: z.enum(['week', 'month']), date: z.iso.date() });

export interface PeriodReport {
  expense_minor: number;
  income_minor: number;
  balance_minor: number;
  breakdown: CategoryTotal[];
}

/** Devuelve los totales y el desglose de la semana o mes UTC que contiene la fecha. */
export async function getPeriodReport(db: Database, input: unknown): Promise<PeriodReport> {
  const parsed = periodSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError('VALIDATION', 'Invalid report period', parsed.error);
  }

  const anchor = new Date(parsed.data.date);
  const weekly = parsed.data.period === 'week';
  let from: string;
  let until: string;
  try {
    from = weekly ? startOfWeek(anchor) : startOfMonth(anchor);
    const end = new Date(weekly ? endOfWeek(anchor) : endOfMonth(anchor));
    end.setUTCDate(end.getUTCDate() + 1);
    until = toDateKey(end);
  } catch (error) {
    throw new AppError('VALIDATION', 'Report period is outside the supported date range', error);
  }

  const breakdown = await withDatabaseAccess(db, () => listCategoryTotals(db, from, until));
  let expense = 0;
  let income = 0;
  for (const category of breakdown) {
    if (category.kind === 'expense') expense += category.amount_minor;
    else income += category.amount_minor;
  }

  return {
    expense_minor: expense,
    income_minor: income,
    balance_minor: income - expense,
    breakdown,
  };
}
