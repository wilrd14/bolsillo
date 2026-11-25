import type { Database, StoredRow } from '@/db/database';
import { createLocalId } from '@/db/local-id';
import { insertOutbox } from '@/db/outbox-repository';

/** Encola la versión escrita usando la misma conexión y transacción del cambio. */
export function enqueueChange(db: Database, entity: 'category' | 'transaction', row: StoredRow) {
  return insertOutbox(db, createLocalId(), entity, row.deleted_at ? 'delete' : 'upsert', row);
}
