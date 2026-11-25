/// <reference types="node" />

import { DatabaseSync } from 'node:sqlite';
import type { Database } from '@/db/database';
import { migrate } from '@/db/migrate';
import { createCategory } from '@/features/categories';
import { getPeriodReport } from '@/features/reports';

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

it.each([
  ['week', '2026-01-01', '2025-12-28', '2025-12-29', '2026-01-04', '2026-01-05'],
  ['month', '2024-02-15', '2024-01-31', '2024-02-01', '2024-02-29', '2024-03-01'],
])('includes both UTC boundaries of the %s', async (period, anchor, before, first, last, next) => {
  const food = await createCategory(db, { kind: 'expense', name: 'Comida' });
  const fares = await createCategory(db, { kind: 'expense', name: 'Transporte' });
  const salary = await createCategory(db, { kind: 'income', name: 'Salario' });
  const movements = [
    [food.id, 'expense', 60, first, null],
    [food.id, 'expense', 60, first + 'T00:00:00.000Z', null],
    [fares.id, 'expense', 60, last + 'T23:59:59.999Z', null],
    [salary.id, 'income', 300, last, null],
    [food.id, 'expense', 60, before + 'T23:59:59.999Z', null],
    [food.id, 'expense', 60, next + 'T00:00:00.000Z', null],
    [food.id, 'expense', 60, last, next],
  ];
  for (const [index, movement] of movements.entries()) {
    await db.runAsync(
      `INSERT INTO "transaction" (id, category_id, kind, amount_minor, occurred_at,
        deleted_at, currency, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'DOP', ?, ?)`,
      String(index),
      ...movement,
      first + 'T00:00:00.000Z',
      next + 'T00:00:00.000Z',
    );
  }

  expect(await getPeriodReport(db, { period, date: anchor })).toEqual({
    expense_minor: 180,
    income_minor: 300,
    balance_minor: 120,
    breakdown: [
      { category_id: salary.id, kind: 'income', amount_minor: 300 },
      { category_id: food.id, kind: 'expense', amount_minor: 120 },
      { category_id: fares.id, kind: 'expense', amount_minor: 60 },
    ],
  });
});

it('returns zero totals for an empty period and validates the requested period', async () => {
  await expect(getPeriodReport(db, { period: 'month', date: '2026-01-01' })).resolves.toEqual({
    expense_minor: 0,
    income_minor: 0,
    balance_minor: 0,
    breakdown: [],
  });
  await expect(getPeriodReport(db, { period: 'month', date: '2026-02-30' })).rejects.toMatchObject({
    code: 'VALIDATION',
  });
});
