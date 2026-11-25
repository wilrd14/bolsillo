import { z } from 'zod';

import { toDateKey, toIsoUtc } from '@/core/dates';
import { AppError } from '@/core/errors';
import type { Database } from '@/db/database';
import { createLocalId } from '@/db/local-id';
import { withDatabaseAccess, withDatabaseTransaction } from '@/db/transaction';
import { findCategoryById } from '@/features/categories';
import {
  createRecurringRepository,
  type RecurringRule,
} from '@/features/recurring/data/recurring-repository';
import {
  advanceDue,
  reminderDate,
  type RecurringReminders,
} from '@/features/recurring/service/schedule';
import { enqueueChange } from '@/sync/outbox';

const ruleSchema = z.strictObject({
  kind: z.enum(['expense', 'income']),
  amount_minor: z.int().positive(),
  category_id: z.uuid(),
  frequency: z.enum(['weekly', 'monthly', 'yearly']),
  next_due: z.iso.date(),
  remind_days_before: z.int().nonnegative().optional(),
  active: z.union([z.literal(0), z.literal(1)]).optional(),
});
const patchSchema = ruleSchema.partial();
const idSchema = z.uuid();
const currencySchema = z.string().regex(/^[A-Z]{3}$/);

function validate<Value>(schema: z.ZodType<Value>, input: unknown): Value {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new AppError('VALIDATION', 'Invalid recurring input', parsed.error);
  return parsed.data;
}

async function validateCategory(db: Database, row: RecurringRule) {
  const category = await findCategoryById(db, row.category_id);
  if (!category || category.kind !== row.kind || category.archived) {
    throw new AppError('VALIDATION', 'Invalid recurring category');
  }
}

/** Expone operaciones locales de reglas y el procesamiento al abrir la app. */
export function createRecurringService(
  db: Database,
  reminders: RecurringReminders,
  clock: () => Date = () => new Date(),
) {
  const repository = createRecurringRepository(db);

  // Lee la version ya confirmada para que una edicion concurrente no restaure un aviso anterior.
  function reconcileReminders(id?: string) {
    return withDatabaseAccess(db, async () => {
      const rows = id ? [await repository.find(id)] : await repository.list();
      for (const row of rows) {
        if (row) await reminders.replace(row.id, reminderDate(row, clock()));
      }
    });
  }

  async function createRule(input: unknown) {
    const parsed = validate(ruleSchema, input);
    const row = await withDatabaseTransaction(db, async () => {
      const timestamp = toIsoUtc(clock());
      const row: RecurringRule = {
        ...parsed,
        active: parsed.active ?? 1,
        remind_days_before: parsed.remind_days_before ?? 0,
        id: createLocalId(),
        created_at: timestamp,
        updated_at: timestamp,
        deleted_at: null,
      };
      await validateCategory(db, row);
      await repository.insert(row);
      await repository.setAnchor(row);
      return row;
    });
    await reconcileReminders(row.id);
    return row;
  }

  async function updateRule(id: unknown, input: unknown) {
    const ruleId = validate(idSchema, id);
    const patch = validate(patchSchema, input);
    const row = await withDatabaseTransaction(db, async () => {
      const current = await repository.find(ruleId);
      if (!current) throw new AppError('VALIDATION', 'Recurring rule does not exist');
      const row: RecurringRule = {
        ...current,
        ...patch,
        active: patch.active ?? current.active,
        remind_days_before: patch.remind_days_before ?? current.remind_days_before,
        updated_at: toIsoUtc(clock()),
      };
      if (row.category_id !== current.category_id || row.kind !== current.kind) {
        await validateCategory(db, row);
      }
      await repository.update(row);
      if (row.next_due !== current.next_due || row.frequency !== current.frequency) {
        await repository.setAnchor(row);
      }
      return row;
    });
    await reconcileReminders(row.id);
    return row;
  }

  /** Genera los vencimientos y encola sus movimientos dentro de la misma transaccion. */
  async function generateDue(input: unknown) {
    const currency = validate(currencySchema, input);
    await withDatabaseTransaction(db, async () => {
      const now = clock();
      const today = toDateKey(now);
      const timestamp = toIsoUtc(now);
      for (const rule of await repository.list()) {
        if (!rule.active || rule.next_due > today) continue;
        const anchor = await repository.anchorDay(rule);
        let index = await repository.nextIndex(rule.id);
        while (rule.next_due <= today) {
          const movement = {
            id: createLocalId(),
            kind: rule.kind,
            amount_minor: rule.amount_minor,
            currency,
            category_id: rule.category_id,
            merchant: null,
            note: null,
            receipt_id: null,
            recurring_id: rule.id,
            occurrence_index: index++,
            occurred_at: rule.next_due,
            created_at: timestamp,
            updated_at: timestamp,
            deleted_at: null,
          };
          if ((await repository.insertOccurrence(movement)).changes) {
            await enqueueChange(db, 'transaction', movement);
          }
          rule.next_due = advanceDue(rule, anchor);
        }
        await repository.update({ ...rule, updated_at: timestamp });
      }
    });
    await reconcileReminders();
  }

  return {
    listRules: () => withDatabaseAccess(db, repository.list),
    createRule,
    updateRule,
    pauseRule: (id: unknown) => updateRule(id, { active: 0 }),
    generateDue,
  };
}
