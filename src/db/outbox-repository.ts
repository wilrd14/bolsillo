import { AppError } from '@/core/errors';
import type { Database, SqlValue, StoredRow } from '@/db/database';
import { createLocalId } from '@/db/local-id';

export const SYNC_ENTITIES = [
  'category',
  'receipt',
  'recurring_rule',
  'budget',
  'transaction',
] as const;
export type SyncEntity = (typeof SYNC_ENTITIES)[number];

interface OutboxItem {
  id: string;
  entity: SyncEntity;
  entity_id: string;
  payload: string;
  attempts: number;
  retry_at: string | null;
}

export function insertOutbox(
  db: Database,
  id: string,
  entity: SyncEntity,
  operation: 'upsert' | 'delete',
  row: StoredRow,
) {
  return db.runAsync(
    'INSERT INTO outbox (id, entity, entity_id, op, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    id,
    entity,
    row.id,
    operation,
    JSON.stringify(row),
    row.updated_at,
  );
}

/** Adopta el ID publicado y conserva en la cola cualquier edición local pendiente. */
async function reconcileIdentity(
  db: Database,
  table: '"budget"' | '"transaction"',
  key: string,
  values: SqlValue[],
  row: StoredRow,
) {
  const [canonical] = await db.getAllAsync<Pick<StoredRow, 'updated_at' | 'deleted_at'>>(
    `SELECT updated_at, deleted_at FROM ${table} WHERE id = ?`,
    row.id,
  );
  if (!canonical) {
    await db.runAsync(
      `UPDATE ${table} SET id = ? WHERE ${key} AND id <> ?`,
      row.id,
      ...values,
      row.id,
    );
  } else if (
    row.updated_at > canonical.updated_at ||
    (row.updated_at === canonical.updated_at && (row.deleted_at || !canonical.deleted_at))
  ) {
    await db.runAsync(`DELETE FROM ${table} WHERE ${key} AND id <> ?`, ...values, row.id);
  }
}

/** Persiste la cola y aplica cambios remotos sobre la misma conexión SQLite. */
export function createOutboxRepository(db: Database) {
  const setting = async (key: string) =>
    (
      await db.getAllAsync<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', key)
    )[0]?.value;
  const save = (key: string, value: string) =>
    db.runAsync('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)', key, value);
  const forget = (key: string) => db.runAsync('DELETE FROM app_settings WHERE key = ?', key);
  const ownerKey = 'sync.owner';
  const cursorKey = 'sync.server_cursors';
  const versionPrefix = (entity: SyncEntity) =>
    entity === 'recurring_rule' ? 'sync.queued.anchor.' : `sync.queued.${entity}.`;
  const versionKey = (entity: SyncEntity, id: string) => versionPrefix(entity) + id;
  const retryKey = (id: string) => `sync.retry.${id}`;

  return {
    async prepare(userId: string) {
      const owner = await setting(ownerKey);
      if (owner && owner !== userId)
        throw new AppError('VALIDATION', 'Database belongs to another account');
      if (!owner) {
        // Una instalación nueva no debe ganar frente a categorías editadas en otro dispositivo.
        const seedVersion = '1970-01-01T00:00:00.001Z';
        await db.runAsync(
          `UPDATE category SET created_at = ?, updated_at = ?
           WHERE is_default = 1 AND created_at = updated_at AND deleted_at IS NULL
             AND NOT EXISTS (SELECT 1 FROM outbox WHERE entity = 'category' AND entity_id = category.id)`,
          seedVersion,
          seedVersion,
        );
        await save(ownerKey, userId);
      }

      // Las categorías iniciales, las reglas y los recibos ya existían sin escritor de outbox.
      for (const entity of ['category', 'receipt', 'recurring_rule'] as const) {
        const rows = await db.getAllAsync<StoredRow>(
          `SELECT t.* FROM ${entity} t
           LEFT JOIN app_settings s ON s.key = ? || t.id
           WHERE (s.value IS NULL OR s.value < t.updated_at)
             AND NOT EXISTS (
               SELECT 1 FROM outbox o WHERE o.entity = ? AND o.entity_id = t.id
                 AND o.created_at = t.updated_at
                 AND (o.entity <> 'recurring_rule' OR json_extract(o.payload, '$.anchor_day') IS NOT NULL)
             )`,
          versionPrefix(entity),
          entity,
        );
        for (const row of rows) {
          const payload =
            entity === 'recurring_rule' && 'next_due' in row && typeof row.next_due === 'string'
              ? {
                  ...row,
                  anchor_day: Number(
                    (await setting(`recurring.anchor.${row.id}`)) ?? row.next_due.slice(8),
                  ),
                }
              : row;
          await insertOutbox(
            db,
            createLocalId(),
            entity,
            row.deleted_at ? 'delete' : 'upsert',
            payload,
          );
          await save(versionKey(entity, row.id), row.updated_at);
        }
      }
      const queue = await db.getAllAsync<OutboxItem>(
        `SELECT o.id, o.entity, o.entity_id, o.payload, o.attempts, s.value AS retry_at FROM outbox o
         LEFT JOIN app_settings s ON s.key = 'sync.retry.' || o.id
         ORDER BY o.rowid`,
      );
      return { queue, cursor: (await setting(cursorKey)) ?? '{}' };
    },
    async assertOwner(userId: string) {
      if ((await setting(ownerKey)) !== userId) {
        throw new AppError('VALIDATION', 'Synchronization owner changed');
      }
    },
    async retry(id: string, at: number) {
      const { changes } = await db.runAsync(
        'UPDATE outbox SET attempts = attempts + 1 WHERE id = ?',
        id,
      );
      if (changes) await save(retryKey(id), String(at));
    },
    async merge(entity: SyncEntity, row: StoredRow) {
      if (entity === 'budget' && 'category_id' in row && 'month' in row) {
        await reconcileIdentity(
          db,
          '"budget"',
          'category_id = ? AND month = ?',
          [row.category_id as SqlValue, row.month as SqlValue],
          row,
        );
      }
      if (
        entity === 'transaction' &&
        'recurring_id' in row &&
        row.recurring_id !== null &&
        'occurrence_index' in row
      ) {
        await reconcileIdentity(
          db,
          '"transaction"',
          'recurring_id = ? AND occurrence_index = ?',
          [row.recurring_id as SqlValue, row.occurrence_index as SqlValue],
          row,
        );
      }
      const table = `"${entity}"`;
      if (entity === 'recurring_rule' && 'anchor_day' in row && row.anchor_day != null) {
        const [current] = await db.getAllAsync<StoredRow>(
          'SELECT updated_at FROM recurring_rule WHERE id = ?',
          row.id,
        );
        if (!current || row.updated_at >= current.updated_at) {
          await save(`recurring.anchor.${row.id}`, String(row.anchor_day));
        }
      }
      const fields = Object.entries(row).filter(
        ([column]) => column !== 'local_uri' && column !== 'anchor_day',
      );
      const columns = fields.map(([column]) => column);
      const values = fields.map(([, value]) => value as SqlValue);
      const assignment = columns
        .filter((column) => column !== 'id')
        .map((column) => `${column} = excluded.${column}`)
        .join(', ');
      await db.runAsync(
        `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})
         ON CONFLICT(id) DO UPDATE SET ${assignment}
         WHERE excluded.updated_at > ${table}.updated_at
           OR (excluded.updated_at = ${table}.updated_at
             AND (excluded.deleted_at IS NOT NULL OR ${table}.deleted_at IS NULL))`,
        ...values,
      );
      await save(versionKey(entity, row.id), row.updated_at);
    },
    async finish(cursor: string, acknowledged: string[]) {
      for (const id of acknowledged) {
        await db.runAsync('DELETE FROM outbox WHERE id = ?', id);
        await forget(retryKey(id));
      }
      await save(cursorKey, cursor);
    },
  };
}
