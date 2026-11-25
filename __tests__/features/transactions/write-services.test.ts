/// <reference types="node" />

import { DatabaseSync } from 'node:sqlite';
import { toDateKey } from '@/core/dates';
import { wipeLocalData } from '@/db/client';
import type { Database } from '@/db/database';
import { migrate } from '@/db/migrate';
import { archiveCategory, createCategory, updateCategory } from '@/features/categories';
import {
  createTransaction,
  deleteTransaction,
  listTransactions,
  updateTransaction,
} from '@/features/transactions';

const expense = { name: 'Prueba', kind: 'expense' };
const movement = { kind: 'expense', amount_minor: 100, currency: 'DOP' };
const page = { limit: 20, offset: 0 };
const missing = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const invalid = { name: 'AppError', code: 'VALIDATION' };
let sqlite: DatabaseSync;
let db: Database;

beforeEach(async () => {
  sqlite = new DatabaseSync(':memory:');
  db = {
    async execAsync(sql) {
      sqlite.exec(sql);
    },
    async getAllAsync<Row>(sql: string, ...params: (string | number | null)[]) {
      return sqlite.prepare(sql).all(...params) as Row[];
    },
    async runAsync(sql, ...params) {
      return { changes: Number(sqlite.prepare(sql).run(...params).changes) };
    },
  };
  await migrate(db);
});

afterEach(() => sqlite.close());

it('preserves history through category edits, archiving and transaction edits', async () => {
  const category = await createCategory(db, { ...expense, name: ' Prueba ', icon: 'star' });
  const id = category.id;
  expect(category).toMatchObject({ name: 'Prueba', archived: 0, is_default: 0 });
  const transaction = await createTransaction(db, { ...movement, category_id: id, note: 'Nota' });
  expect(transaction.occurred_at).toBe(toDateKey(new Date()));
  const updatedCategory = await updateCategory(db, id, { name: 'Editada', icon: null });
  expect(updatedCategory).toMatchObject({ name: 'Editada', icon: null });
  const archived = await archiveCategory(db, id);
  expect(archived).toMatchObject({ archived: 1, deleted_at: null });
  const updated = await updateTransaction(db, transaction.id, { amount_minor: 250, note: null });
  expect(await listTransactions(db, page)).toEqual([updated]);
  expect(updated).toMatchObject({ category_id: id, amount_minor: 250, note: null });
  await deleteTransaction(db, transaction.id);
  expect(await listTransactions(db, page)).toEqual([]);
  const [deleted] = await db.getAllAsync<{ deleted_at: string }>(
    'SELECT deleted_at FROM "transaction" WHERE id = ?',
    transaction.id,
  );
  expect(deleted.deleted_at).toBeTruthy();

  const events = await db.getAllAsync<{ op: string; payload: string }>(
    'SELECT op, payload FROM outbox ORDER BY rowid',
  );
  expect(events.map(({ op, payload }) => [op, JSON.parse(payload)])).toEqual([
    ['upsert', category],
    ['upsert', transaction],
    ['upsert', updatedCategory],
    ['upsert', archived],
    ['upsert', updated],
    ['delete', { ...updated, ...deleted, updated_at: deleted.deleted_at }],
  ]);
});

it('rejects invalid inputs and references without changing data or outbox', async () => {
  const category = await createCategory(db, expense);
  const input = { ...movement, category_id: category.id };
  const transaction = await createTransaction(db, input);

  for (const patch of [
    { amount_minor: 0 },
    { amount_minor: 0.5 },
    { occurred_at: '9999-12-31' },
    { occurred_at: '2026-02-30' },
    { kind: 'income' },
    { category_id: missing },
    { receipt_id: missing },
    { occurrence_index: 0 },
  ]) {
    await expect(createTransaction(db, { ...input, ...patch })).rejects.toMatchObject(invalid);
    await expect(updateTransaction(db, transaction.id, patch)).rejects.toMatchObject(invalid);
  }

  await expect(updateTransaction(db, missing, {})).rejects.toMatchObject(invalid);
  await expect(deleteTransaction(db, missing)).rejects.toMatchObject(invalid);
  await expect(createCategory(db, { ...expense, name: ' ' })).rejects.toMatchObject(invalid);
  await expect(updateCategory(db, category.id, { kind: 'income' })).rejects.toMatchObject(invalid);
  await expect(archiveCategory(db, 'bad')).rejects.toMatchObject(invalid);
  await expect(archiveCategory(db, missing)).rejects.toMatchObject(invalid);
  await archiveCategory(db, category.id);
  await expect(createTransaction(db, input)).rejects.toMatchObject(invalid);
  expect(await listTransactions(db, page)).toEqual([transaction]);
  expect(await db.getAllAsync('SELECT id FROM outbox')).toHaveLength(3);
});

it('rolls back when outbox insertion fails and serializes concurrent service writes', async () => {
  await db.execAsync(`
    CREATE TEMP TRIGGER reject_outbox BEFORE INSERT ON outbox
    WHEN json_extract(NEW.payload, '$.name') = 'Falla'
    BEGIN SELECT RAISE(ABORT, 'outbox unavailable'); END;
  `);
  const failure = createCategory(db, { ...expense, name: 'Falla' });
  const success = createCategory(db, expense);
  const read = listTransactions(db, page);
  await expect(failure).rejects.toThrow('outbox unavailable');
  await expect(success).resolves.toMatchObject({ name: expense.name });
  await expect(read).resolves.toEqual([]);
  expect(await db.getAllAsync('SELECT id FROM category WHERE is_default = 0')).toHaveLength(1);
  expect(await db.getAllAsync('SELECT id FROM outbox')).toHaveLength(1);
});

it('physically removes rows from all local tables and preserves the schema version', async () => {
  const category = await createCategory(db, expense);
  await db.runAsync(
    'INSERT INTO receipt (id, status, created_at, updated_at) VALUES (?, ?, ?, ?)',
    missing,
    'done',
    category.created_at,
    category.updated_at,
  );
  await db.runAsync(
    `INSERT INTO recurring_rule
       (id, kind, amount_minor, category_id, frequency, next_due, created_at, updated_at)
     VALUES (?, 'expense', 100, ?, 'monthly', '2026-01-01', ?, ?)`,
    missing,
    category.id,
    category.created_at,
    category.updated_at,
  );
  await db.runAsync(
    `INSERT INTO budget (id, category_id, month, limit_minor, created_at, updated_at)
     VALUES ('budget', ?, '2026-01', 100, ?, ?)`,
    category.id,
    category.created_at,
    category.updated_at,
  );
  await db.execAsync("INSERT INTO app_settings VALUES ('currency', 'DOP')");
  await createTransaction(db, {
    ...movement,
    category_id: category.id,
    receipt_id: missing,
    recurring_id: missing,
    occurrence_index: 0,
  });

  await wipeLocalData(db);
  await wipeLocalData(db);
  for (const table of [
    '"transaction"',
    'category',
    'receipt',
    'recurring_rule',
    'budget',
    'outbox',
    'app_settings',
  ]) {
    expect(await db.getAllAsync(`SELECT * FROM ${table}`)).toEqual([]);
  }
  expect(await db.getAllAsync('PRAGMA user_version')).toEqual([{ user_version: 1 }]);
});
