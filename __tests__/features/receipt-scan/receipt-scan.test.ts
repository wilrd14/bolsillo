/// <reference types="node" />

import { DatabaseSync } from 'node:sqlite';

import type { Database, SqlValue } from '@/db/database';
import { migrate } from '@/db/migrate';
import { createCategory } from '@/features/categories';
import {
  createReceiptScanService,
  type ReceiptScanDependencies,
} from '@/features/receipt-scan/service/receipt-scan';

const userId = '11111111-1111-4111-8111-111111111111';
const extraction = {
  merchant: 'Comercio de prueba',
  date: '2020-01-01',
  total_minor: 500,
  tax_minor: 0,
  currency: 'DOP',
  items: [],
  confidence: { merchant: 1, date: 1, total: 1 },
};

let sqlite: DatabaseSync;
let db: Database;
let connected: boolean;
let reconnect: () => void;
let deps: ReceiptScanDependencies;
let service: ReturnType<typeof createReceiptScanService>;

beforeEach(async () => {
  sqlite = new DatabaseSync(':memory:');
  db = {
    async execAsync(sql) {
      sqlite.exec(sql);
    },
    async getAllAsync<Row>(sql: string, ...params: SqlValue[]) {
      return sqlite.prepare(sql).all(...params) as Row[];
    },
    async runAsync(sql, ...params) {
      return { changes: Number(sqlite.prepare(sql).run(...params).changes) };
    },
  };
  await migrate(db);
  connected = false;
  deps = {
    compress: jest.fn(async () => 'file:///cache.jpg'),
    files: {
      save: jest.fn(async () => 'file:///local.jpg'),
      read: jest.fn(async () => new ArrayBuffer(1)),
      remove: jest.fn(async () => undefined),
    },
    network: {
      isOnline: async () => connected,
      onReconnect(listener) {
        reconnect = listener;
        return jest.fn();
      },
    },
    remote: {
      userId: async () => userId,
      upload: jest.fn(async () => undefined),
      scan: jest.fn(async () => ({ ok: true, body: extraction })),
      remove: jest.fn(async () => undefined),
    },
  };
  service = createReceiptScanService(db, deps);
});

afterEach(() => sqlite.close());

it('persists offline, drains once on reconnect and creates a movement only on confirmation', async () => {
  const onError = jest.fn();
  const unsubscribe = service.watchQueue(onError);
  const row = await service.enqueueReceipt('file:///synthetic.jpg');
  expect(row.status).toBe('pending');
  expect(deps.files.save).toHaveBeenCalledWith('file:///cache.jpg', row.id);
  expect(deps.remote.upload).not.toHaveBeenCalled();

  connected = true;
  reconnect();
  reconnect();
  await service.processQueue();
  expect(deps.remote.upload).toHaveBeenCalledTimes(1);
  expect(deps.remote.scan).toHaveBeenCalledTimes(1);
  expect(await service.getReceipt(row.id)).toMatchObject({
    status: 'done',
    storage_path: `${userId}/${row.id}.jpg`,
    extracted_json: JSON.stringify(extraction),
  });
  expect(onError).not.toHaveBeenCalled();
  expect(await db.getAllAsync('SELECT id FROM "transaction"')).toEqual([]);

  const category = await createCategory(db, { name: 'Prueba', kind: 'expense' });
  const fields = {
    category_id: category.id,
    amount_minor: 600,
    currency: 'DOP',
    occurred_at: '2020-01-01',
  };
  await expect(service.confirmReceipt(row.id, fields)).resolves.toMatchObject({
    kind: 'expense',
    receipt_id: row.id,
    amount_minor: 600,
  });
  await expect(service.confirmReceipt(row.id, fields)).rejects.toMatchObject({
    code: 'VALIDATION',
  });
  await expect(service.cancelReceipt(row.id)).rejects.toMatchObject({ code: 'VALIDATION' });
  unsubscribe();
});

it('removes an offline scan and leaves nothing for reconnect to upload', async () => {
  const row = await service.enqueueReceipt('file:///synthetic.jpg');
  await service.cancelReceipt(row.id);
  expect(deps.files.remove).toHaveBeenCalledWith('file:///local.jpg');
  expect(await service.listPending()).toEqual([]);
  connected = true;
  await service.processQueue();
  expect(deps.remote.upload).not.toHaveBeenCalled();
});

it.each([
  [false, { error: { code: 'not_a_receipt' } }, 'NOT_A_RECEIPT'],
  [false, { error: { code: 'quota_exceeded' } }, 'QUOTA_EXCEEDED'],
  [false, { error: { code: 'unauthorized' } }, 'VALIDATION'],
  [false, { error: { code: 'invalid_request' } }, 'VALIDATION'],
  [false, { error: { code: 'image_not_found' } }, 'VALIDATION'],
  [false, { error: { code: 'provider_error' } }, 'VALIDATION'],
  [true, { ...extraction, total_minor: 9.5 }, 'VALIDATION'],
])('records a safe error code for response %s %j', async (ok, body, code) => {
  deps.remote.scan = async () => ({ ok, body });
  connected = true;
  const row = await service.enqueueReceipt('file:///synthetic.jpg');
  expect(row).toMatchObject({ status: 'failed', error_code: code, extracted_json: null });
});
