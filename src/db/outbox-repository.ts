import type { Database, StoredRow } from '@/db/database';

export function insertOutbox(
  db: Database,
  id: string,
  entity: 'category' | 'transaction',
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
