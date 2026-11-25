import type { Database, StoredRow } from '@/db/database';
import { createLocalId } from '@/db/local-id';
import { insertOutbox, type SyncEntity } from '@/db/outbox-repository';

/** Encola la versión escrita usando la misma conexión y transacción del cambio. */
export function enqueueChange(db: Database, entity: SyncEntity, row: StoredRow) {
  return insertOutbox(db, createLocalId(), entity, row.deleted_at ? 'delete' : 'upsert', row);
}
