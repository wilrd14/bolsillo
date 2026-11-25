/// <reference types="node" />

import { DatabaseSync } from 'node:sqlite';
import type { Database } from '@/db/database';
import { migrate } from '@/db/migrate';
import { wipeLocalData } from '@/db/client';
import { ensureDefaultCategories } from '@/db/seed-categories';
import {
  listCaptureCategories,
  loadLastKind,
  rememberKind,
  saveCapture,
} from '@/features/capture/service/capture-service';

const COMIDA = '4765444e-b400-4ec3-9b6e-6ed0950edcd1';
const TRANSPORTE = '5dc9d1cc-e758-47a6-a6ce-c98605823a52';
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

const entry = (categoryId: string, amountMinor = 1250) => ({
  kind: 'expense' as const,
  amountMinor,
  currency: 'DOP',
  categoryId,
  note: '  ',
  date: new Date().toISOString().slice(0, 10),
});

it('remembers the last kind and defaults to expense', async () => {
  expect(await loadLastKind(db)).toBe('expense');
  await rememberKind(db, 'income');
  await rememberKind(db, 'income');
  expect(await loadLastKind(db)).toBe('income');
});

it('lists the most recently used category first', async () => {
  const names = async () => (await listCaptureCategories(db, 'expense')).map((c) => c.name);
  expect(await names()).toEqual(['Comida', 'Transporte']);
  await saveCapture(db, entry(TRANSPORTE));
  expect(await names()).toEqual(['Transporte', 'Comida']);
});

it('saves a movement with a blank note stored as null and rejects a zero amount', async () => {
  const saved = await saveCapture(db, entry(COMIDA));
  expect(saved).toMatchObject({ amount_minor: 1250, note: null, category_id: COMIDA });
  await expect(saveCapture(db, entry(COMIDA, 0))).rejects.toMatchObject({ code: 'VALIDATION' });
});

it('reseeds default categories only when the table is empty', async () => {
  await ensureDefaultCategories(db);
  expect(await listCaptureCategories(db, 'expense')).toHaveLength(2);
  await wipeLocalData(db);
  expect(await listCaptureCategories(db, 'expense')).toHaveLength(0);
  await ensureDefaultCategories(db);
  expect(await listCaptureCategories(db, 'income')).toHaveLength(1);
});
