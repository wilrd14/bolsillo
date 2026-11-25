/** @jest-environment node */

import { DatabaseSync } from 'node:sqlite';

import type { Database, SqlValue } from '@/db/database';
import { migrate } from '@/db/migrate';
import { enqueueChange } from '@/sync/outbox';
import { createSynchronizer, type SyncRemote } from '@/sync/synchronize';

const connections: DatabaseSync[] = [];
let db: Database;
let user: string;
let remote: SyncRemote;
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

const older = '2026-11-25T00:00:01.000Z';
const newer = '2026-11-25T00:00:02.000Z';

const baseCategoryRow = {
  id: '6126ab26-5f32-4c94-bd14-c53c69d048a4',
  created_at: older,
  updated_at: older,
  deleted_at: null as string | null,
  name: 'Original',
  kind: 'expense' as const,
  icon: null as string | null,
  color: null as string | null,
  is_default: 0 as const,
  archived: 0 as const,
};

function categoryRow(overrides: Partial<typeof baseCategoryRow> = {}): typeof baseCategoryRow {
  return { ...baseCategoryRow, ...overrides };
}

beforeEach(async () => {
  db = await createDatabase();
  user = 'test-account';
  remote = {
    userId: async () => user,
    push: async () => undefined,
    async *pull() {
      /* sin filas remotas por defecto */
    },
  };
  sync = createSynchronizer(db, { remote, isOnline: async () => true, now: () => Date.now() });
});

afterEach(() => {
  for (const connection of connections.splice(0)) connection.close();
});

test('conflicto: la versión recibida más reciente gana al no sobrescribirse', async () => {
  const early = categoryRow({ name: 'V1' });
  const late = categoryRow({ name: 'V2', updated_at: newer });
  remote.pull = async function* (_user: string, entity: string) {
    if (entity !== 'category') return;
    yield { ...late, synced_at: newer };
    yield { ...early, synced_at: older };
  };
  await enqueueChange(db, 'category', early);

  await sync();

  const [row] = await db.getAllAsync(
    'SELECT name, updated_at FROM category WHERE id = ?',
    baseCategoryRow.id,
  );
  expect(row).toEqual({ name: 'V2', updated_at: newer });
  expect(await db.getAllAsync('SELECT COUNT(*) AS c FROM outbox')).toEqual([{ c: 0 }]);
});

test('duplicado: la misma versión recibida dos veces no crea fila ni cola', async () => {
  const row = categoryRow({ name: 'V1' });
  remote.pull = async function* (_user: string, entity: string) {
    if (entity !== 'category') return;
    yield { ...row, synced_at: older };
    yield { ...row, synced_at: older };
  };
  await enqueueChange(db, 'category', row);

  await sync();

  expect(
    await db.getAllAsync('SELECT COUNT(*) AS c FROM category WHERE id = ?', baseCategoryRow.id),
  ).toEqual([{ c: 1 }]);
  expect(await db.getAllAsync('SELECT COUNT(*) AS c FROM outbox')).toEqual([{ c: 0 }]);
});

test('red intermitente: ciclo OFFLINE conserva la cola y el reintento sincroniza', async () => {
  const row = categoryRow({ name: 'V1' });
  await enqueueChange(db, 'category', row);
  let online = false;
  const cycle = createSynchronizer(db, {
    remote,
    isOnline: async () => online,
    now: () => Date.now(),
  });

  await expect(cycle()).rejects.toMatchObject({ code: 'OFFLINE' });
  expect(await db.getAllAsync('SELECT COUNT(*) AS c FROM outbox')).toEqual([{ c: 1 }]);

  online = true;
  await cycle();
  expect(await db.getAllAsync('SELECT COUNT(*) AS c FROM outbox')).toEqual([{ c: 0 }]);
});
