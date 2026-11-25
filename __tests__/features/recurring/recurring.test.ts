/// <reference types="node" />

import { DatabaseSync } from 'node:sqlite';

import type { Database } from '@/db/database';
import { migrate } from '@/db/migrate';
import { createRecurringService } from '@/features/recurring';

const category = '4765444e-b400-4ec3-9b6e-6ed0950edcd1';
let sqlite: DatabaseSync;
let db: Database;
let now: Date;
const replace = jest.fn(async (_id: string, _date: Date | null) => {});
const rule = {
  kind: 'expense',
  category_id: category,
  amount_minor: 150,
  frequency: 'monthly',
  next_due: '2024-01-31',
  remind_days_before: 3,
};

function service() {
  return createRecurringService(db, { replace }, () => now);
}

function movements() {
  return sqlite
    .prepare('SELECT occurred_at, occurrence_index FROM "transaction" ORDER BY occurrence_index')
    .all()
    .map((row) => [row.occurred_at, row.occurrence_index]);
}

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
  now = new Date('2024-01-01T00:00:00Z');
  replace.mockClear();
});

afterEach(() => sqlite.close());

it.each([
  ['weekly', '2024-01-31', '2024-02-15', ['2024-01-31', '2024-02-07', '2024-02-14']],
  ['monthly', '2024-01-31', '2024-04-01', ['2024-01-31', '2024-02-29', '2024-03-31']],
  [
    'yearly',
    '2024-02-29',
    '2028-03-01',
    ['2024-02-29', '2025-02-28', '2026-02-28', '2027-02-28', '2028-02-29'],
  ],
])('generates missed %s cycles exactly once', async (frequency, nextDue, today, dates) => {
  const recurring = service();
  await recurring.createRule({ ...rule, frequency, next_due: nextDue });
  now = new Date(today + 'T00:00:00Z');
  await Promise.all([recurring.generateDue('DOP'), service().generateDue('DOP')]);
  expect(movements()).toEqual(dates.map((date, index) => [date, index]));
  const queued = sqlite.prepare("SELECT entity FROM outbox WHERE entity = 'transaction'").all();
  expect(queued).toHaveLength(dates.length);
});

it('replaces reminders on edit and cancels them on pause', async () => {
  const recurring = service();
  const created = await recurring.createRule(rule);
  expect(replace).toHaveBeenLastCalledWith(created.id, new Date('2024-01-28T00:00:00Z'));
  await recurring.updateRule(created.id, { next_due: '2024-02-15' });
  expect(replace).toHaveBeenLastCalledWith(created.id, new Date('2024-02-12T00:00:00Z'));
  await recurring.pauseRule(created.id);
  expect(replace).toHaveBeenLastCalledWith(created.id, null);
  now = new Date('2024-04-01T00:00:00Z');
  await recurring.generateDue('DOP');
  expect(movements()).toEqual([]);
  expect((await recurring.listRules())[0]).toMatchObject({ active: 0, next_due: '2024-02-15' });
});

it('rolls back generation if its outbox write fails and can retry', async () => {
  const recurring = service();
  await recurring.createRule(rule);
  now = new Date('2024-03-01T00:00:00Z');
  sqlite.exec(`
    CREATE TRIGGER fail_outbox BEFORE INSERT ON outbox
    BEGIN SELECT RAISE(ABORT, 'outbox unavailable'); END;
  `);
  await expect(recurring.generateDue('DOP')).rejects.toThrow('outbox unavailable');
  expect(movements()).toEqual([]);
  expect((await recurring.listRules())[0].next_due).toBe('2024-01-31');

  sqlite.exec('DROP TRIGGER fail_outbox');
  await recurring.generateDue('DOP');
  expect(movements()).toEqual([
    ['2024-01-31', 0],
    ['2024-02-29', 1],
  ]);
});
