import type { Database } from '@/db/database';

/** Devuelve a la cola solo los escaneos que este dispositivo puede reintentar. */
export function recoverInterruptedReceipts(db: Database) {
  return db.runAsync(
    `UPDATE receipt SET status = 'pending'
     WHERE status = 'processing' AND local_uri IS NOT NULL AND deleted_at IS NULL`,
  );
}
