import { z } from 'zod';

import { toDateKey, toIsoUtc } from '@/core/dates';
import { AppError } from '@/core/errors';
import type { Database } from '@/db/database';
import { createLocalId } from '@/db/local-id';
import { withDatabaseTransaction } from '@/db/transaction';
import { findCategoryById } from '@/features/categories';
import {
  createTransactionRepository,
  type TransactionRow,
} from '@/features/transactions/data/transaction-repository';
import { enqueueChange } from '@/sync/outbox';

// Tolera hasta UTC+14: la fecha local de hoy puede ir por delante de la fecha UTC.
const MAX_UTC_OFFSET_MS = 14 * 60 * 60 * 1000;
const dateSchema = z.iso
  .date()
  .refine((date) => date <= toDateKey(new Date(Date.now() + MAX_UTC_OFFSET_MS)));
const createSchema = z.strictObject({
  kind: z.enum(['expense', 'income']),
  amount_minor: z.int().positive(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  category_id: z.uuid(),
  merchant: z.string().trim().nullish(),
  note: z.string().trim().nullish(),
  occurred_at: dateSchema.optional(),
  receipt_id: z.uuid().nullish(),
  recurring_id: z.uuid().nullish(),
  occurrence_index: z.int().nonnegative().nullish(),
});
const updateSchema = createSchema.partial();
const idSchema = z.uuid();

function validate<Value>(schema: z.ZodType<Value>, input: unknown): Value {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new AppError('VALIDATION', 'Invalid transaction input', parsed.error);
  }
  return parsed.data;
}

async function validateRelations(db: Database, row: TransactionRow, previous?: TransactionRow) {
  const category = await findCategoryById(db, row.category_id);
  if (
    !category ||
    category.kind !== row.kind ||
    (category.archived && previous?.category_id !== row.category_id)
  ) {
    throw new AppError('VALIDATION', 'Invalid transaction category');
  }
  if ((row.recurring_id === null) !== (row.occurrence_index === null)) {
    throw new AppError('VALIDATION', 'Invalid recurring occurrence');
  }
  const linksChanged =
    row.receipt_id !== (previous?.receipt_id ?? null) ||
    row.recurring_id !== (previous?.recurring_id ?? null) ||
    row.occurrence_index !== (previous?.occurrence_index ?? null);
  if (linksChanged && !(await createTransactionRepository(db).hasAvailableLinks(row))) {
    throw new AppError('VALIDATION', 'Unavailable transaction links');
  }
}

/** Guarda un movimiento y encola su versión inicial. */
export async function createTransaction(db: Database, input: unknown) {
  const parsed = validate(createSchema, input);
  return withDatabaseTransaction(db, async () => {
    const now = new Date();
    const timestamp = toIsoUtc(now);
    const row: TransactionRow = {
      ...parsed,
      id: createLocalId(),
      merchant: parsed.merchant ?? null,
      note: parsed.note ?? null,
      occurred_at: parsed.occurred_at ?? toDateKey(now),
      receipt_id: parsed.receipt_id ?? null,
      recurring_id: parsed.recurring_id ?? null,
      occurrence_index: parsed.occurrence_index ?? null,
      created_at: timestamp,
      updated_at: timestamp,
      deleted_at: null,
    };
    await validateRelations(db, row);
    await createTransactionRepository(db).insert(row);
    await enqueueChange(db, 'transaction', row);
    return row;
  });
}

/** Aplica una edición parcial y conserva los campos omitidos. */
export async function updateTransaction(db: Database, id: unknown, input: unknown) {
  const transactionId = validate(idSchema, id);
  const patch = validate(updateSchema, input);
  return withDatabaseTransaction(db, async () => {
    const repository = createTransactionRepository(db);
    const current = await repository.findById(transactionId);
    if (!current) {
      throw new AppError('VALIDATION', 'Transaction does not exist');
    }
    const row = {
      ...current,
      kind: patch.kind ?? current.kind,
      amount_minor: patch.amount_minor ?? current.amount_minor,
      currency: patch.currency ?? current.currency,
      category_id: patch.category_id ?? current.category_id,
      occurred_at: validate(dateSchema, patch.occurred_at ?? current.occurred_at),
      merchant: patch.merchant === undefined ? current.merchant : patch.merchant,
      note: patch.note === undefined ? current.note : patch.note,
      receipt_id: patch.receipt_id === undefined ? current.receipt_id : patch.receipt_id,
      recurring_id: patch.recurring_id === undefined ? current.recurring_id : patch.recurring_id,
      occurrence_index:
        patch.occurrence_index === undefined ? current.occurrence_index : patch.occurrence_index,
      updated_at: toIsoUtc(new Date()),
    };
    await validateRelations(db, row, current);
    await repository.update(row.id, row);
    await enqueueChange(db, 'transaction', row);
    return row;
  });
}

/** Borra lógicamente y publica la marca de borrado para la sincronización. */
export async function deleteTransaction(db: Database, id: unknown) {
  const transactionId = validate(idSchema, id);
  return withDatabaseTransaction(db, async () => {
    const repository = createTransactionRepository(db);
    const current = await repository.findById(transactionId);
    if (!current) {
      throw new AppError('VALIDATION', 'Transaction does not exist');
    }
    const timestamp = toIsoUtc(new Date());
    await repository.softDelete(transactionId, timestamp);
    await enqueueChange(db, 'transaction', {
      ...current,
      updated_at: timestamp,
      deleted_at: timestamp,
    });
  });
}
