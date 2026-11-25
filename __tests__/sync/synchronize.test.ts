/** @jest-environment node */

import { DatabaseSync } from 'node:sqlite';

import type { Database, SqlValue } from '@/db/database';
import { migrate } from '@/db/migrate';
import { createRecurringService } from '@/features/recurring';
import { createReceiptScanService, type ReceiptScanDependencies } from '@/features/receipt-scan';
import type { SyncCursor, SyncRow } from '@/sync/rows';
import { enqueueChange } from '@/sync/outbox';
import { createSynchronizer, type SyncRemote } from '@/sync/synchronize';

const connections: DatabaseSync[] = [];
let db: Database;
let now: number;
let user: string | null;
let rows: Map<string, SyncRow & SyncCursor>;
let serverTime: number;
let remote: SyncRemote;
let push: jest.MockedFunction<SyncRemote['push']>;
let sync: () => Promise<void>;

async function createDatabase() {
  const sqlite = new DatabaseSync(':memory:');
  connections.push(sqlite);
  const connection: Database = {
    async execAsync(sql) {
      sqlite.exec(sql);
    },
    async runAsync(sql, ...args) {
      return { changes: Number(sqlite.prepare(sql).run(...args).changes) };
    },
    async getAllAsync<Row>(sql: string, ...args: SqlValue[]) {
      return sqlite.prepare(sql).all(...args) as Row[];
    },
  };
  await migrate(connection);
  return connection;
}

function connect(connection: Database, isOnline = async () => true) {
  return createSynchronizer(connection, { now: () => now, isOnline, remote });
}

beforeEach(async () => {
  db = await createDatabase();
  now = Date.now();
  serverTime = Date.UTC(2026, 10, 25);
  user = 'test-account';
  rows = new Map();
  push = jest.fn(async (_user, entity, row) => {
    const naturalKey =
      entity === 'budget' && 'month' in row
        ? `${row.category_id}/${row.month}`
        : entity === 'transaction' && 'recurring_id' in row && row.recurring_id
          ? `${row.recurring_id}/${row.occurrence_index}`
          : null;
    const key = `${entity}/${naturalKey ?? row.id}`;
    const current = rows.get(key);
    if (
      !current ||
      row.updated_at > current.updated_at ||
      (row.updated_at === current.updated_at && row.deleted_at && !current.deleted_at)
    ) {
      rows.set(key, {
        ...row,
        id: current?.id ?? row.id,
        synced_at: new Date(++serverTime).toISOString(),
      });
    }
    if (naturalKey) return rows.get(key);
  });
  remote = {
    userId: async () => user,
    push,
    async *pull(_user, entity, after) {
      const ordered = [...rows.entries()].sort(
        ([, a], [, b]) => a.synced_at.localeCompare(b.synced_at) || a.id.localeCompare(b.id),
      );
      for (const [key, row] of ordered) {
        if (
          key.startsWith(`${entity}/`) &&
          (!after ||
            row.synced_at > after.synced_at ||
            (row.synced_at === after.synced_at && row.id > after.id))
        )
          yield row;
      }
    },
  };
  sync = connect(db);
});

afterEach(() => {
  for (const connection of connections.splice(0)) connection.close();
});

test('sube el recibo antes del movimiento y conserva la URI en el dispositivo', async () => {
  const receiptId = 'd913a97a-aefe-4897-b940-8166dbee395d';
  const transactionId = '29d6c50f-2a40-4871-8cc7-fba292b85e15';
  const categoryId = '4765444e-b400-4ec3-9b6e-6ed0950edcd1';
  const timestamp = new Date(now).toISOString();
  await db.runAsync(
    'INSERT INTO receipt (id, local_uri, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    receiptId,
    'file:///synthetic.jpg',
    'done',
    timestamp,
    timestamp,
  );
  const movement = {
    id: transactionId,
    kind: 'expense',
    amount_minor: 250,
    currency: 'DOP',
    category_id: categoryId,
    merchant: null,
    note: null,
    occurred_at: '2026-11-25',
    receipt_id: receiptId,
    recurring_id: null,
    occurrence_index: null,
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: null,
  };
  await enqueueChange(db, 'transaction', movement);
  await sync();
  const sent = push.mock.calls.map(([, entity]) => entity);
  expect(sent.indexOf('receipt')).toBeLessThan(sent.indexOf('transaction'));
  expect(rows.get(`receipt/${receiptId}`)).toMatchObject({ local_uri: null });
  expect(await db.getAllAsync('SELECT local_uri FROM receipt WHERE id = ?', receiptId)).toEqual([
    { local_uri: 'file:///synthetic.jpg' },
  ]);
});

test('propaga un descarte sin conexión y retira la imagen remota al sincronizar', async () => {
  const deviceB = await createDatabase();
  const syncB = connect(deviceB);
  const deps: ReceiptScanDependencies = {
    compress: async (uri) => uri,
    files: {
      save: async (uri) => uri,
      read: async () => new ArrayBuffer(1),
      remove: jest.fn(async () => undefined),
    },
    network: { isOnline: async () => false, onReconnect: () => () => undefined },
    remote: {
      userId: async () => null,
      upload: async () => undefined,
      scan: async () => ({ ok: false, body: null }),
      remove: async () => undefined,
    },
  };
  const a = createReceiptScanService(db, deps);
  const b = createReceiptScanService(deviceB, deps);
  const { id } = await a.enqueueReceipt('file:///synthetic.jpg');
  const path = `${user}/${id}.jpg`;
  const images = new Set([path]);
  await db.runAsync("UPDATE receipt SET storage_path = ?, status = 'done' WHERE id = ?", path, id);
  const persist = push.getMockImplementation()!;
  push.mockImplementation(async (owner, entity, row) => {
    await persist(owner, entity, row);
    if (entity === 'receipt' && rows.get(`receipt/${row.id}`)?.deleted_at) {
      images.delete(`${owner}/${row.id}.jpg`);
    }
  });

  await sync();
  await syncB();
  expect(await b.getReceipt(id)).toMatchObject({ status: 'done' });
  await a.cancelReceipt(id);
  expect(await a.getReceipt(id)).toBeUndefined();
  expect(images.has(path)).toBe(true);
  await sync();
  await syncB();
  expect(rows.get(`receipt/${id}`)?.deleted_at).toBeTruthy();
  expect(await b.getReceipt(id)).toBeUndefined();
  expect(images.has(path)).toBe(false);
});

test('sin cuenta no escribe, y dos ciclos con cuenta no duplican filas', async () => {
  user = null;
  await sync();
  expect(push).not.toHaveBeenCalled();
  user = 'test-account';
  await sync();
  await sync();
  expect(push).toHaveBeenCalledTimes(3);
  expect(rows.size).toBe(3);
});

test('conserva la cola y respeta la espera creciente tras un fallo', async () => {
  push.mockRejectedValueOnce(new Error('offline')).mockRejectedValueOnce(new Error('offline'));
  await expect(sync()).rejects.toMatchObject({ code: 'OFFLINE' });
  const query = 'SELECT attempts FROM outbox ORDER BY rowid';
  expect(await db.getAllAsync(query)).toEqual([{ attempts: 1 }, { attempts: 0 }, { attempts: 0 }]);
  now += 1000;
  await expect(sync()).rejects.toMatchObject({ code: 'OFFLINE' });
  now += 1999;
  await sync();
  expect(push).toHaveBeenCalledTimes(2);
  now++;
  await sync();
  expect(await db.getAllAsync(query)).toEqual([]);
});

test('aplica el borrado remoto posterior a la edición local', async () => {
  await sync();
  const [key, remote] = [...rows.entries()][0];
  const edited = new Date(now + 1000).toISOString();
  const deleted = new Date(now + 2000).toISOString();
  await db.runAsync('UPDATE category SET updated_at = ? WHERE id = ?', edited, remote.id);
  rows.set(key, {
    ...remote,
    updated_at: deleted,
    deleted_at: deleted,
    synced_at: new Date(++serverTime).toISOString(),
  });
  await sync();
  const [row] = await db.getAllAsync('SELECT deleted_at FROM category WHERE id = ?', remote.id);
  expect(row).toEqual({ deleted_at: deleted });
});

const earlyEdit = '2026-11-23T00:00:00.000Z';
const laterEdit = '2026-11-24T00:00:00.000Z';

async function editCategory(device: Database, id: string, name: string, version: string) {
  await device.runAsync(
    'UPDATE category SET name = ?, updated_at = ? WHERE id = ?',
    name,
    version,
    id,
  );
}

async function expectCategory(device: Database, id: string, name: string, version: string) {
  expect(
    await device.getAllAsync('SELECT name, updated_at FROM category WHERE id = ?', id),
  ).toEqual([{ name, updated_at: version }]);
}

test('A descarga la edición tardía de B aunque su versión sea anterior a otra ya descargada', async () => {
  const deviceB = await createDatabase();
  let online = false;
  const syncB = connect(deviceB, async () => online);
  await sync();
  const [shared, other] = [...rows.values()];
  await editCategory(deviceB, shared.id, 'Edición sin conexión', earlyEdit);
  await expect(syncB()).rejects.toMatchObject({ code: 'OFFLINE' });
  await editCategory(db, other.id, 'Edición de A', laterEdit);
  await sync();
  await expectCategory(db, other.id, 'Edición de A', laterEdit);

  online = true;
  await syncB();
  await sync();

  await expectCategory(db, shared.id, 'Edición sin conexión', earlyEdit);
  await expectCategory(deviceB, shared.id, 'Edición sin conexión', earlyEdit);
  await expectCategory(deviceB, other.id, 'Edición de A', laterEdit);
});

test('ambos dispositivos conservan la versión mayor aunque se publique primero', async () => {
  const deviceB = await createDatabase();
  const syncB = connect(deviceB);
  await sync();
  await syncB();
  const [shared] = [...rows.values()];
  await editCategory(deviceB, shared.id, 'Versión anterior', earlyEdit);
  await editCategory(db, shared.id, 'Versión posterior', laterEdit);

  await sync();
  await syncB();
  await sync();

  expect(push).toHaveBeenCalledWith(
    user,
    'category',
    expect.objectContaining({
      id: shared.id,
      updated_at: earlyEdit,
    }),
  );
  await expectCategory(db, shared.id, 'Versión posterior', laterEdit);
  await expectCategory(deviceB, shared.id, 'Versión posterior', laterEdit);
  expect(rows.get(`category/${shared.id}`)).toMatchObject({ updated_at: laterEdit });
});

const food = '4765444e-b400-4ec3-9b6e-6ed0950edcd1';

test('ambos dispositivos conservan el ancla 31 y fusionan ocurrencias independientes', async () => {
  const deviceB = await createDatabase();
  const syncB = connect(deviceB);
  let date = new Date('2026-02-28T12:00:00Z');
  const reminders = { replace: async () => undefined };
  const a = createRecurringService(db, reminders, () => date);
  const b = createRecurringService(deviceB, reminders, () => date);
  await a.createRule({
    kind: 'expense',
    amount_minor: 500,
    category_id: food,
    frequency: 'monthly',
    next_due: '2026-01-31',
  });
  await a.generateDue('DOP');
  await sync();
  await syncB();

  date = new Date('2026-04-30T12:00:00Z');
  await a.generateDue('DOP');
  await b.generateDue('DOP');
  const dates = 'SELECT occurred_at FROM "transaction" ORDER BY occurrence_index';
  expect(await deviceB.getAllAsync(dates)).toEqual([
    { occurred_at: '2026-01-31' },
    { occurred_at: '2026-02-28' },
    { occurred_at: '2026-03-31' },
    { occurred_at: '2026-04-30' },
  ]);
  expect(await deviceB.getAllAsync(dates)).toEqual(await db.getAllAsync(dates));
  await sync();
  await syncB();
  await sync();
  const movements = 'SELECT id, occurred_at FROM "transaction" ORDER BY occurrence_index';
  expect(await deviceB.getAllAsync(movements)).toEqual(await db.getAllAsync(movements));
  expect(await deviceB.getAllAsync('SELECT id FROM outbox')).toEqual([]);
});

test('fusiona un presupuesto con un borrado posterior bajo el ID canónico', async () => {
  const deviceB = await createDatabase();
  const syncB = connect(deviceB);
  const a = {
    id: '11111111-1111-4111-8111-111111111111',
    category_id: food,
    month: '2026-11',
    limit_minor: 100,
    alerted_80: 0,
    alerted_100: 0,
    created_at: earlyEdit,
    updated_at: earlyEdit,
    deleted_at: null,
  };
  const b = {
    ...a,
    id: '22222222-2222-4222-8222-222222222222',
    limit_minor: 200,
    updated_at: laterEdit,
    deleted_at: laterEdit,
  };
  for (const [device, row] of [
    [db, a],
    [deviceB, b],
  ] as const) {
    await device.runAsync(
      `INSERT INTO budget (id, category_id, month, limit_minor, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      row.id,
      row.category_id,
      row.month,
      row.limit_minor,
      row.created_at,
      row.updated_at,
      row.deleted_at,
    );
    await enqueueChange(device, 'budget', row);
  }
  await sync();
  await syncB();
  await sync();
  const sql = 'SELECT id, limit_minor, deleted_at FROM budget';
  for (const device of [db, deviceB]) {
    expect(await device.getAllAsync(sql)).toEqual([
      { id: a.id, limit_minor: 200, deleted_at: laterEdit },
    ]);
  }
});
