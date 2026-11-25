/** @jest-environment node */

import { randomUUID } from 'node:crypto';

import type { SupabaseClient } from '@supabase/supabase-js';

import { createSupabaseSync } from '@/sync/supabase-sync';
import type { SyncRow } from '@/sync/rows';

const userId = '11111111-1111-1111-1111-111111111111';
const row: SyncRow = {
  id: '6126ab26-5f32-4c94-bd14-c53c69d048a4',
  created_at: '2026-11-25T00:00:00.000Z',
  updated_at: '2026-11-25T00:00:00.000Z',
  deleted_at: null,
  name: 'Prueba',
  kind: 'expense',
  icon: null,
  color: null,
  is_default: 0,
  archived: 0,
};

interface Table {
  upsert: jest.Mock;
  update: jest.Mock;
  select: jest.Mock;
  eq: jest.Mock;
  or: jest.Mock;
  order: jest.Mock;
  limit: jest.Mock;
  lt: jest.Mock;
  lte: jest.Mock;
  single: jest.Mock;
}

type SyncClient = Parameters<typeof createSupabaseSync>[0];

function registerTable(entity: string, rows: unknown[] = []): { client: SyncClient; table: Table } {
  const table: Table = {
    upsert: jest.fn(async () => ({ error: null })),
    update: jest.fn(() => table),
    select: jest.fn(() => table),
    eq: jest.fn(() => table),
    or: jest.fn(() => table),
    order: jest.fn(() => table),
    limit: jest.fn(async () => ({ data: rows, error: null })),
    lt: jest.fn(() => table),
    lte: jest.fn(() => table),
    single: jest.fn(async () => ({ data: rows[0], error: null })),
  };
  const from = (name: string) => {
    if (name !== entity) throw new Error(`tabla inesperada: ${name}`);
    return table;
  };
  const client = { auth: {}, from } as unknown as SyncClient;
  return { client, table };
}

test('push es idempotente: upsert onConflict por (user_id, id) y update con updated_at anterior', async () => {
  const { client, table } = registerTable('category');
  const remote = createSupabaseSync(client);

  await remote.push(userId, 'category', row);

  expect(table.upsert).toHaveBeenCalledWith(
    expect.objectContaining({ user_id: userId, id: row.id }),
    {
      onConflict: 'user_id,id',
      ignoreDuplicates: true,
    },
  );
  expect(table.update).toHaveBeenCalledWith(
    expect.objectContaining({ user_id: userId, id: row.id }),
  );
  expect(table.eq).toHaveBeenCalledWith('user_id', userId);
  expect(table.eq).toHaveBeenCalledWith('id', row.id);
  expect(table.lt).toHaveBeenCalledWith('updated_at', row.updated_at);
});

test('push lanza cuando el upsert falla', async () => {
  const { client, table } = registerTable('category');
  table.upsert.mockResolvedValueOnce({ error: { message: 'duplicate' } });
  const remote = createSupabaseSync(client);

  await expect(remote.push(userId, 'category', row)).rejects.toMatchObject({
    message: 'duplicate',
  });
  expect(table.update).not.toHaveBeenCalled();
});

test('push devuelve la fila canónica del RPC como un objeto', async () => {
  const { client } = registerTable('budget');
  const budget: SyncRow = {
    id: row.id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: null,
    category_id: row.id,
    month: '2026-11',
    limit_minor: 100,
    alerted_80: 0,
    alerted_100: 0,
  };
  const canonical = { ...budget, id: randomUUID() };
  const single = jest.fn(async () => ({ data: canonical, error: null }));
  const rpc = jest.fn(() => ({ single }));
  const remote = createSupabaseSync({ ...client, rpc: rpc as unknown as SupabaseClient['rpc'] });
  await expect(remote.push(userId, 'budget', budget)).resolves.toEqual(canonical);
  expect(rpc).toHaveBeenCalledWith('merge_sync_budget', {
    payload: { ...budget, user_id: userId },
  });
  expect(single).toHaveBeenCalledTimes(1);
});

test('push retira la imagen solo si el servidor aceptó el descarte', async () => {
  const { client, table } = registerTable('receipt');
  const remove = jest.fn(async () => ({ error: null }));
  const remote = createSupabaseSync({
    ...client,
    storage: { from: jest.fn(() => ({ remove })) } as unknown as SupabaseClient['storage'],
  });
  const tombstone: SyncRow = {
    id: row.id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.updated_at,
    local_uri: null,
    storage_path: null,
    status: 'processing',
    extracted_json: null,
    error_code: null,
  };
  table.single.mockResolvedValueOnce({ data: { deleted_at: null }, error: null });
  await remote.push(userId, 'receipt', tombstone);
  expect(remove).not.toHaveBeenCalled();
  table.single.mockResolvedValue({ data: { deleted_at: tombstone.deleted_at }, error: null });
  remove.mockRejectedValueOnce(new Error('storage unavailable'));
  await expect(remote.push(userId, 'receipt', tombstone)).rejects.toThrow('storage unavailable');
  await remote.push(userId, 'receipt', tombstone);
  expect(remove).toHaveBeenLastCalledWith([`${userId}/${row.id}.jpg`]);
});

test('pull devuelve las filas en orden y detiene el ciclo en una página parcial', async () => {
  const page = [
    { id: '21decd55-e9d4-4b60-9f82-f544e3f02b48', synced_at: '2026-11-25T00:00:01.000Z' },
    { id: 'd6dcd8cb-9472-4e09-a39e-736be5785c31', synced_at: '2026-11-25T00:00:02.000Z' },
  ];
  const { client, table } = registerTable('category', page);
  table.limit.mockResolvedValueOnce({ data: page, error: null });
  const remote = createSupabaseSync(client);

  const pulled: string[] = [];
  for await (const value of remote.pull(userId, 'category')) {
    pulled.push(String((value as { id: string }).id));
  }
  expect(pulled).toEqual(page.map((value) => value.id));
  expect(table.limit).toHaveBeenCalledTimes(1);
});

test('pull página completa sigue recorriendo hasta la página parcial', async () => {
  const fullPage = Array.from({ length: 250 }, (_, index) => ({
    id: randomUUID(),
    synced_at: new Date(Date.UTC(2026, 10, 25, 0, 0, index)).toISOString(),
  }));
  const { client, table } = registerTable('category');
  table.limit.mockResolvedValueOnce({ data: fullPage, error: null }).mockResolvedValueOnce({
    data: [],
    error: null,
  });
  const remote = createSupabaseSync(client);

  const pulled: string[] = [];
  for await (const value of remote.pull(userId, 'category')) {
    pulled.push(String((value as { id: string }).id));
  }
  expect(pulled).toHaveLength(250);
  expect(table.limit).toHaveBeenCalledTimes(2);
});
