/** @jest-environment node */

import { DatabaseSync } from 'node:sqlite';

import type { Database, SqlValue } from '@/db/database';
import { migrate } from '@/db/migrate';
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
    const key = `${entity}/${row.id}`;
    const current = rows.get(key);
    if (!current || row.updated_at > current.updated_at) {
      rows.set(key, { ...row, synced_at: new Date(++serverTime).toISOString() });
    }
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
