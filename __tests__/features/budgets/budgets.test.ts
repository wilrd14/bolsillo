/// <reference types="node" />

import { DatabaseSync } from 'node:sqlite';
import type { Database } from '@/db/database';
import { migrate } from '@/db/migrate';
import { createBudget, deleteBudget, listBudgetProgress, updateBudget } from '@/features/budgets';
import { createCategory } from '@/features/categories';
import { createTransaction, deleteTransaction } from '@/features/transactions';

const month = '2025-12';
const invalid = { code: 'VALIDATION' };
let sqlite: DatabaseSync;
let db: Database;
let input: { category_id: string; month: string; limit_minor: number };

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
  const category = await createCategory(db, { kind: 'expense', name: 'Prueba' });
  input = { category_id: category.id, month, limit_minor: 100 };
});

afterEach(() => sqlite.close());

it.each([0, 79, 80, 100, 121])(
  'calculates %i%% from expenses in the selected month',
  async (spent) => {
    await createBudget(db, input);
    const movement = {
      kind: 'expense',
      category_id: input.category_id,
      amount_minor: 500,
      currency: 'DOP',
      occurred_at: `${month}-01`,
    };
    if (spent) {
      await createTransaction(db, { ...movement, amount_minor: spent, occurred_at: `${month}-31` });
    }
    const deleted = await createTransaction(db, movement);
    await deleteTransaction(db, deleted.id);
    await createTransaction(db, { ...movement, occurred_at: '2026-01-01' });

    const progress = await listBudgetProgress(db, month);
    expect(progress).toHaveLength(1);
    expect(progress[0]).toMatchObject({
      spent_minor: spent,
      remaining_minor: 100 - spent,
      percentage: spent,
    });
  },
);

it('serializes duplicate creation, edits, deletes and recreates with matching outbox entries', async () => {
  const [first, duplicate] = await Promise.allSettled([
    createBudget(db, input),
    createBudget(db, input),
  ]);
  expect(duplicate).toMatchObject({ status: 'rejected', reason: invalid });
  if (first.status === 'rejected') throw first.reason;
  const { id } = first.value;
  const updated = await updateBudget(db, id, { limit_minor: 200 });
  expect(updated).toMatchObject({ ...input, id, limit_minor: 200 });
  await deleteBudget(db, id);
  expect(await listBudgetProgress(db, month)).toEqual([]);
  await expect(deleteBudget(db, id)).rejects.toMatchObject(invalid);
  const recreated = await createBudget(db, input);
  expect(recreated).toMatchObject({ ...input, id, deleted_at: null });

  const events = await db.getAllAsync<{ op: string; entity_id: string; payload: string }>(
    "SELECT op, entity_id, payload FROM outbox WHERE entity = 'budget' ORDER BY rowid",
  );
  expect(events.map((event) => event.op)).toEqual(['upsert', 'upsert', 'delete', 'upsert']);
  expect(events.map((event) => event.entity_id)).toEqual([id, id, id, id]);
  expect(JSON.parse(events[1].payload)).toEqual(updated);
  expect(JSON.parse(events[2].payload)).toMatchObject({ deleted_at: expect.any(String) });
  expect(JSON.parse(events[3].payload)).toEqual(recreated);
});

it('validates inputs and rejects edits that collide with another budget', async () => {
  const budget = await createBudget(db, input);
  const other = await createBudget(db, { ...input, month: '2025-11' });
  await expect(updateBudget(db, budget.id, { month: other.month })).rejects.toMatchObject(invalid);
  await expect(updateBudget(db, budget.id, { month: '2025-10' })).resolves.toMatchObject({
    month: '2025-10',
  });
  await expect(updateBudget(db, 'invalid', {})).rejects.toMatchObject(invalid);
  await expect(createBudget(db, { ...input, limit_minor: 1.5 })).rejects.toMatchObject(invalid);
  await expect(listBudgetProgress(db, '2025-13')).rejects.toMatchObject(invalid);
  const income = await createCategory(db, { kind: 'income', name: 'Prueba' });
  await expect(createBudget(db, { ...input, category_id: income.id })).rejects.toMatchObject(
    invalid,
  );
});

it('rolls back the budget write if its outbox entry fails', async () => {
  await db.execAsync(`
    CREATE TEMP TRIGGER reject_budget_outbox BEFORE INSERT ON outbox
    WHEN NEW.entity = 'budget'
    BEGIN SELECT RAISE(ABORT, 'outbox unavailable'); END;
  `);
  await expect(createBudget(db, input)).rejects.toThrow('outbox unavailable');
  expect(await listBudgetProgress(db, month)).toEqual([]);
});
