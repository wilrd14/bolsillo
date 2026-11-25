import { z } from 'zod';

import { toIsoUtc } from '@/core/dates';
import { AppError } from '@/core/errors';
import { percentage, sumMoney } from '@/core/money';
import type { Database } from '@/db/database';
import { createLocalId } from '@/db/local-id';
import { withDatabaseAccess, withDatabaseTransaction } from '@/db/transaction';
import { createBudgetRepository, type BudgetRow } from '@/features/budgets/data/budget-repository';
import { findCategoryById } from '@/features/categories';

const idSchema = z.uuid();
const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const createSchema = z.strictObject({
  category_id: idSchema,
  month: monthSchema,
  limit_minor: z.int().positive(),
});
const updateSchema = createSchema.partial();

function validate<Value>(schema: z.ZodType<Value>, input: unknown): Value {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new AppError('VALIDATION', 'Invalid budget input', parsed.error);
  }
  return parsed.data;
}

async function validateCategory(db: Database, id: string) {
  const category = await findCategoryById(db, id);
  if (!category || category.kind !== 'expense' || category.archived) {
    throw new AppError('VALIDATION', 'Invalid budget category');
  }
}

/** Crea el presupuesto mensual o recupera su fila si se había borrado. */
export async function createBudget(db: Database, input: unknown) {
  const values = validate(createSchema, input);
  return withDatabaseTransaction(db, async () => {
    const repository = createBudgetRepository(db);
    await validateCategory(db, values.category_id);
    const previous = await repository.findByPeriod(values.category_id, values.month);
    if (previous && !previous.deleted_at) {
      throw new AppError('VALIDATION', 'Budget already exists for this category and month');
    }
    const timestamp = toIsoUtc(new Date());
    const row: BudgetRow = {
      ...values,
      id: previous?.id ?? createLocalId(),
      created_at: previous?.created_at ?? timestamp,
      updated_at: timestamp,
      deleted_at: null,
      alerted_80: previous?.alerted_80 ?? 0,
      alerted_100: previous?.alerted_100 ?? 0,
    };
    if (previous) {
      await repository.update(row);
    } else {
      await repository.insert(row);
    }
    await repository.enqueue(row);
    return row;
  });
}

/** Edita los campos indicados y conserva el historial de alertas dentro del mismo período. */
export async function updateBudget(db: Database, id: unknown, input: unknown) {
  const budgetId = validate(idSchema, id);
  const patch = validate(updateSchema, input);
  return withDatabaseTransaction(db, async () => {
    const repository = createBudgetRepository(db);
    const current = await repository.findById(budgetId);
    if (!current) {
      throw new AppError('VALIDATION', 'Budget does not exist');
    }
    const categoryId = patch.category_id ?? current.category_id;
    const month = patch.month ?? current.month;
    const changedPeriod = categoryId !== current.category_id || month !== current.month;
    if (categoryId !== current.category_id) {
      await validateCategory(db, categoryId);
    }
    if (changedPeriod && (await repository.findByPeriod(categoryId, month))) {
      throw new AppError('VALIDATION', 'Budget already exists for this category and month');
    }
    const row: BudgetRow = {
      ...current,
      category_id: categoryId,
      month,
      limit_minor: patch.limit_minor ?? current.limit_minor,
      updated_at: toIsoUtc(new Date()),
      alerted_80: changedPeriod ? 0 : current.alerted_80,
      alerted_100: changedPeriod ? 0 : current.alerted_100,
    };
    await repository.update(row);
    await repository.enqueue(row);
    return row;
  });
}

/** Borra el presupuesto localmente y encola la marca de borrado. */
export async function deleteBudget(db: Database, id: unknown) {
  const budgetId = validate(idSchema, id);
  return withDatabaseTransaction(db, async () => {
    const repository = createBudgetRepository(db);
    const current = await repository.findById(budgetId);
    if (!current) {
      throw new AppError('VALIDATION', 'Budget does not exist');
    }
    const timestamp = toIsoUtc(new Date());
    const row = { ...current, updated_at: timestamp, deleted_at: timestamp };
    await repository.update(row);
    await repository.enqueue(row);
  });
}

export interface BudgetProgress extends BudgetRow {
  spent_minor: number;
  remaining_minor: number;
  percentage: number;
}

/** Calcula el progreso de los presupuestos vigentes del mes solicitado. */
export async function listBudgetProgress(db: Database, input: unknown): Promise<BudgetProgress[]> {
  const month = validate(monthSchema, input);
  return withDatabaseAccess(db, async () => {
    const repository = createBudgetRepository(db);
    const budgets = await repository.list(month);
    const spending = await repository.spending(month);
    const spentByCategory = new Map(spending.map((row) => [row.category_id, row.spent_minor]));
    return budgets.map((budget) => {
      const spent = spentByCategory.get(budget.category_id) ?? 0;
      return {
        ...budget,
        spent_minor: spent,
        remaining_minor: sumMoney([budget.limit_minor, -spent]),
        percentage: percentage(spent, budget.limit_minor),
      };
    });
  });
}
