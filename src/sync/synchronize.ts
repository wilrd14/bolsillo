import { z } from 'zod';

import { AppError } from '@/core/errors';
import type { Database } from '@/db/database';
import { createOutboxRepository, SYNC_ENTITIES, type SyncEntity } from '@/db/outbox-repository';
import { withDatabaseTransaction } from '@/db/transaction';

import { cursorSchema, orderQueue, rowSchemas, type SyncCursor, type SyncRow } from './rows';

const cursorsSchema = z.partialRecord(z.enum(SYNC_ENTITIES), cursorSchema);

export interface SyncRemote {
  userId(): Promise<string | null>;
  push(userId: string, entity: SyncEntity, row: SyncRow): Promise<unknown>;
  pull(userId: string, entity: SyncEntity, after?: SyncCursor): AsyncIterable<unknown>;
}

export interface SyncDependencies {
  remote: SyncRemote;
  isOnline(): Promise<boolean>;
  now(): number;
}

const active = new WeakMap<Database, Promise<void>>();

/** Ejecuta un ciclo por conexión y conserva la cola si falla el envío. */
export function createSynchronizer(db: Database, { remote, isOnline, now }: SyncDependencies) {
  const local = createOutboxRepository(db);

  async function run() {
    const userId = await remote.userId();
    if (!userId) return;
    if (!(await isOnline())) throw new AppError('OFFLINE', 'Synchronization requires a connection');

    const { cursor, queue } = await withDatabaseTransaction(db, () => local.prepare(userId));
    const acknowledged: string[] = [];
    const canonicalRows: { entity: SyncEntity; row: SyncRow }[] = [];
    for (const { item, row } of orderQueue(queue)) {
      if (Number(item.retry_at) > now()) break;
      try {
        const canonical = await remote.push(
          userId,
          item.entity,
          'local_uri' in row ? { ...row, local_uri: null } : row,
        );
        if (canonical !== undefined) {
          canonicalRows.push({
            entity: item.entity,
            row: rowSchemas[item.entity].parse(canonical),
          });
        }
      } catch {
        const delay = Math.min(60_000, 1000 * 2 ** Math.min(item.attempts, 6));
        await withDatabaseTransaction(db, () => local.retry(item.id, now() + delay));
        throw new AppError('OFFLINE', 'Synchronization push failed');
      }
      acknowledged.push(item.id);
    }
    const incoming: { entity: SyncEntity; row: SyncRow }[] = [];
    const cursors = cursorsSchema.parse(JSON.parse(cursor));
    for (const entity of SYNC_ENTITIES) {
      incoming.push(...canonicalRows.filter((change) => change.entity === entity));
      for await (const value of remote.pull(userId, entity, cursors[entity])) {
        const row = rowSchemas[entity].parse(value);
        incoming.push({ entity, row });
        cursors[entity] = cursorSchema.parse(value);
      }
    }
    await withDatabaseTransaction(db, async () => {
      await local.assertOwner(userId);
      for (const { entity, row } of incoming) await local.merge(entity, row);
      await local.finish(JSON.stringify(cursors), acknowledged);
    });
  }

  return () => {
    const pending = active.get(db);
    if (pending) return pending;
    const cycle = run().finally(() => active.delete(db));
    active.set(db, cycle);
    return cycle;
  };
}
