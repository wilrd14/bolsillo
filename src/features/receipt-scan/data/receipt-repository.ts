import type { Database, StoredRow } from '@/db/database';

export interface ReceiptRow extends StoredRow {
  local_uri: string | null;
  storage_path: string | null;
  status: 'pending' | 'processing' | 'done' | 'failed';
  extracted_json: string | null;
  error_code: string | null;
}

export function createReceiptRepository(db: Database) {
  return {
    insert(id: string, uri: string, now: string) {
      return db.runAsync(
        "INSERT INTO receipt (id, local_uri, status, created_at, updated_at) VALUES (?, ?, 'pending', ?, ?)",
        id,
        uri,
        now,
        now,
      );
    },
    async find(id: string) {
      const [row] = await db.getAllAsync<ReceiptRow>(
        'SELECT * FROM receipt WHERE id = ? AND deleted_at IS NULL',
        id,
      );
      return row;
    },
    pending() {
      return db.getAllAsync<ReceiptRow>(
        "SELECT * FROM receipt WHERE status = 'pending' AND deleted_at IS NULL ORDER BY created_at, id",
      );
    },
    claim(id: string, now: string) {
      return db.runAsync(
        "UPDATE receipt SET status = 'processing', updated_at = ? WHERE id = ? AND status = 'pending' AND deleted_at IS NULL",
        now,
        id,
      );
    },
    finish(
      id: string,
      status: ReceiptRow['status'],
      now: string,
      path: string | null,
      extracted: string | null,
      error: string | null,
    ) {
      return db.runAsync(
        'UPDATE receipt SET status = ?, updated_at = ?, storage_path = ?, extracted_json = ?, error_code = ? WHERE id = ?',
        status,
        now,
        path,
        extracted,
        error,
        id,
      );
    },
    async isAttached(id: string) {
      const [row] = await db.getAllAsync<{ id: string }>(
        'SELECT id FROM "transaction" WHERE receipt_id = ?',
        id,
      );
      return Boolean(row);
    },
    remove(id: string) {
      return db.runAsync('DELETE FROM receipt WHERE id = ?', id);
    },
  };
}
