import { z } from 'zod';

import { toIsoUtc } from '@/core/dates';
import { AppError } from '@/core/errors';
import { es } from '@/core/strings/es';
import type { Database } from '@/db/database';
import { withDatabaseTransaction } from '@/db/transaction';
import { createBudgetRepository } from '@/features/budgets/data/budget-repository';
import { findCategoryById } from '@/features/categories';

export interface BudgetNotifications {
  getPermission(): Promise<{ granted: boolean; canAskAgain: boolean }>;
  requestPermission(): Promise<boolean>;
  send(body: string): Promise<void>;
}

const expenseSchema = z.object({
  kind: z.enum(['expense', 'income']),
  category_id: z.uuid().nullable(),
  occurred_at: z.iso.date(),
});

const thresholds = [
  { percent: 80, flag: 'alerted_80' },
  { percent: 100, flag: 'alerted_100' },
] as const;

/** Evalúa el acumulado del mes después de confirmar un gasto en SQLite. */
export async function checkBudgetAlerts(
  db: Database,
  movement: unknown,
  notifications: Pick<BudgetNotifications, 'getPermission' | 'send'>,
): Promise<void> {
  const parsed = expenseSchema.safeParse(movement);
  if (!parsed.success) {
    throw new AppError('VALIDATION', 'Invalid movement for budget alerts', parsed.error);
  }
  const { category_id: categoryId, kind, occurred_at: date } = parsed.data;
  if (kind !== 'expense' || !categoryId) {
    return;
  }

  const month = date.slice(0, 7);
  let granted: boolean | undefined;
  for (const { percent, flag } of thresholds) {
    await withDatabaseTransaction(db, async () => {
      const repository = createBudgetRepository(db);
      const budget = await repository.findByPeriod(categoryId, month);
      if (!budget || budget.deleted_at || budget[flag]) return;

      const spending = await repository.spending(month);
      const spent = spending.find((row) => row.category_id === categoryId)?.spent_minor ?? 0;
      if (BigInt(spent) * 100n < BigInt(budget.limit_minor) * BigInt(percent)) return;

      granted ??= (await notifications.getPermission()).granted;
      if (!granted) return;

      const category = await findCategoryById(db, categoryId);
      if (!category) return;

      const updated = { ...budget, [flag]: 1, updated_at: toIsoUtc(new Date()) } as const;
      await repository.update(updated);
      await repository.enqueue(updated);
      await notifications.send(es.budgetWarning(percent, category.name));
    });
    if (granted === false) return;
  }
}

/** Comparte el intento de permiso entre llamadas del flujo de creación. */
export function createBudgetPermissionRequest(
  notifications: Pick<BudgetNotifications, 'getPermission' | 'requestPermission'>,
): () => Promise<boolean> {
  let result: Promise<boolean> | undefined;
  return () =>
    (result ??= (async () => {
      const permission = await notifications.getPermission();
      return (
        permission.granted || (permission.canAskAgain && (await notifications.requestPermission()))
      );
    })());
}
