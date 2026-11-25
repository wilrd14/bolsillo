/// <reference types="node" />

import { DatabaseSync } from 'node:sqlite';
import { createDatabaseClient } from '@/db/client';
import type { Database } from '@/db/database';
import { migrate } from '@/db/migrate';
import { createCategoryRepository } from '@/features/categories/data/category-repository';
import { createTransactionRepository } from '@/features/transactions/data/transaction-repository';

const timestamp = '2026-01-01T00:00:00.000Z';
const changedAt = '2026-01-02T00:00:00.000Z';
const page = { limit: 20, offset: 0 };
const category = {
  id: 'custom',
  name: 'Prueba',
  kind: 'expense' as const,
  icon: null,
  color: null,
  is_default: 0 as const,
  archived: 0 as const,
  created_at: timestamp,
  updated_at: timestamp,
};
const transaction = {
  id: 'movement',
  kind: 'expense' as const,
  amount_minor: 100,
  currency: 'DOP',
  category_id: category.id,
  merchant: 'Comercio de prueba',
  note: 'Nota de prueba',
  occurred_at: '2026-01-01',
  receipt_id: null,
  recurring_id: null,
  occurrence_index: null,
  created_at: timestamp,
  updated_at: timestamp,
};

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

it('applies version 1 once and seeds both kinds', async () => {
  const categories = createCategoryRepository(db);
  const initial = await categories.list(page);
  expect(initial.map((row) => row.kind)).toEqual(expect.arrayContaining(['expense', 'income']));
  expect(initial.every((row) => row.is_default === 1)).toBe(true);
  await migrate(db);
  expect(await categories.list(page)).toEqual(initial);
  expect(await db.getAllAsync('PRAGMA user_version')).toEqual([{ user_version: 1 }]);
});

it('filters, pages, updates and soft-deletes categories without losing movement history', async () => {
  const categories = createCategoryRepository(db);
  const transactions = createTransactionRepository(db);
  await categories.insert(category);
  await transactions.insert(transaction);

  await categories.update(category.id, { ...category, archived: 1, updated_at: changedAt });
  expect(await categories.list({ ...page, archived: 1, search: 'PRUEBA' })).toMatchObject([
    { id: category.id, archived: 1, updated_at: changedAt },
  ]);
  expect(await categories.list({ ...page, offset: 1, archived: 1 })).toEqual([]);

  await categories.softDelete(category.id, changedAt);
  expect(await categories.list({ ...page, search: 'Prueba' })).toEqual([]);
  expect(await categories.list({ ...page, search: 'Prueba', includeDeleted: true })).toMatchObject([
    { id: category.id, deleted_at: changedAt },
  ]);
  expect(await transactions.list({ ...page, categoryId: category.id })).toHaveLength(1);
});

it('filters and pages movements, reads edits and hides deleted rows by default', async () => {
  const categories = createCategoryRepository(db);
  const transactions = createTransactionRepository(db);
  await categories.insert(category);
  await transactions.insert(transaction);
  await transactions.insert({ ...transaction, id: 'newer', occurred_at: '2026-01-03' });
  await transactions.update(transaction.id, { ...transaction, amount_minor: 225 });

  const filters = {
    limit: 1,
    offset: 1,
    search: 'prueba',
    kind: 'expense' as const,
    categoryId: category.id,
    from: '2026-01-01',
    to: '2026-01-03',
  };
  expect(await transactions.list(filters)).toMatchObject([
    { id: transaction.id, amount_minor: 225 },
  ]);
  expect(await transactions.list({ ...filters, kind: 'income' })).toEqual([]);
  await transactions.softDelete(transaction.id, changedAt);
  expect(await transactions.list(filters)).toEqual([]);
  expect(await transactions.list({ ...filters, includeDeleted: true })).toMatchObject([
    { id: transaction.id, deleted_at: changedAt, updated_at: changedAt },
  ]);
});

it('enforces foreign keys, integer money and the budget and occurrence unique keys', async () => {
  const categories = createCategoryRepository(db);
  const transactions = createTransactionRepository(db);
  await expect(transactions.insert(transaction)).rejects.toThrow(/FOREIGN KEY/);
  await categories.insert(category);
  await expect(transactions.insert({ ...transaction, amount_minor: 1.25 })).rejects.toThrow(
    /CHECK/,
  );

  await db.runAsync(
    `INSERT INTO recurring_rule
       (id, kind, amount_minor, category_id, frequency, next_due, created_at, updated_at)
     VALUES ('rule', 'expense', 100, ?, 'monthly', '2026-01-01', ?, ?)`,
    category.id,
    timestamp,
    timestamp,
  );
  const recurring = { ...transaction, recurring_id: 'rule', occurrence_index: 0 };
  await transactions.insert(recurring);
  await transactions.softDelete(recurring.id, changedAt);
  await expect(transactions.insert({ ...recurring, id: 'duplicate' })).rejects.toThrow(/UNIQUE/);

  const insertBudget = `INSERT INTO budget
    (id, category_id, month, limit_minor, created_at, updated_at)
    VALUES (?, ?, '2026-01', 100, ?, ?)`;
  await db.runAsync(insertBudget, 'budget', category.id, timestamp, timestamp);
  await expect(
    db.runAsync(insertBudget, 'duplicate', category.id, timestamp, timestamp),
  ).rejects.toThrow(/UNIQUE/);
});

it('shares initialization and retries when the database cannot be opened', async () => {
  const connection = { ...db, closeAsync: async () => sqlite.close() };
  const open = jest.fn(async (_name: string) => connection);
  open.mockRejectedValueOnce(new Error('open failed'));
  const getDatabase = createDatabaseClient(open);

  await expect(getDatabase()).rejects.toThrow('open failed');
  const ready = getDatabase();
  expect(getDatabase()).toBe(ready);
  await expect(ready).resolves.toBe(connection);
  expect(open.mock.calls).toEqual([['bolsillo.db'], ['bolsillo.db']]);
});

it('acepta movimientos con campos nulos y rechaza importes que rompen la integridad (RNF-09)', async () => {
  const categories = createCategoryRepository(db);
  const transactions = createTransactionRepository(db);
  await categories.insert(category);

  await transactions.insert({ ...transaction, merchant: null, note: null });
  const rows = await transactions.list({ ...page });
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ merchant: null, note: null, amount_minor: 100 });

  await expect(
    transactions.insert({ ...transaction, id: 'cero', amount_minor: 0 }),
  ).rejects.toThrow(/CHECK/);
  await expect(
    transactions.insert({ ...transaction, id: 'negativo', amount_minor: -50 }),
  ).rejects.toThrow(/CHECK/);
  await expect(
    transactions.insert({ ...transaction, id: 'fraccionado', amount_minor: 100.5 }),
  ).rejects.toThrow(/CHECK/);
  expect(await transactions.list({ ...page })).toHaveLength(1);
});

it('concurrencia de escrituras: duplicados y presupuestos únicos rechazan', async () => {
  const categories = createCategoryRepository(db);
  const transactions = createTransactionRepository(db);
  await categories.insert(category);

  await expect(
    Promise.all([transactions.insert(transaction), transactions.insert({ ...transaction })]),
  ).rejects.toThrow(/UNIQUE/);
  expect(await transactions.list({ ...page })).toHaveLength(1);

  await expect(categories.insert(category)).rejects.toThrow(/UNIQUE/);

  const insertBudget = `INSERT INTO budget
    (id, category_id, month, limit_minor, created_at, updated_at)
    VALUES (?, ?, '2026-01', 100, ?, ?)`;
  await db.runAsync(insertBudget, 'budget', category.id, timestamp, timestamp);
  await expect(
    Promise.all([
      db.runAsync(insertBudget, 'budget-2', category.id, timestamp, timestamp),
      db.runAsync(insertBudget, 'budget-3', category.id, timestamp, timestamp),
    ]),
  ).rejects.toThrow(/UNIQUE/);
});

it('pagina en el límite: offset al final y limit igual al total', async () => {
  const categories = createCategoryRepository(db);
  const transactions = createTransactionRepository(db);
  await categories.insert(category);

  for (let index = 0; index < 3; index += 1) {
    await transactions.insert({
      ...transaction,
      id: `movement-${index}`,
      occurred_at: `2026-01-0${index + 1}`,
    });
  }

  expect(await transactions.list({ ...page })).toHaveLength(3);
  expect(await transactions.list({ ...page, offset: 2 })).toHaveLength(1);
  expect(await transactions.list({ ...page, offset: 3 })).toHaveLength(0);
  expect(await transactions.list({ ...page, limit: 100, offset: 100 })).toHaveLength(0);
  expect((await categories.list({ ...page })).length).toBeGreaterThan(0);
});

it('borrado lógico idempotente y update sin efecto tras el borrado', async () => {
  const categories = createCategoryRepository(db);
  const transactions = createTransactionRepository(db);
  await categories.insert(category);
  await transactions.insert(transaction);

  expect(await transactions.softDelete(transaction.id, changedAt)).toMatchObject({ changes: 1 });
  expect(await transactions.softDelete(transaction.id, changedAt)).toMatchObject({ changes: 0 });
  expect(
    await transactions.update(transaction.id, { ...transaction, amount_minor: 300 }),
  ).toMatchObject({ changes: 0 });
  expect(await transactions.list({ ...page, includeDeleted: true })).toMatchObject([
    { id: transaction.id, deleted_at: changedAt },
  ]);
});
