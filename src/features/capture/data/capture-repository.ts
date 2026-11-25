import type { Database, MovementKind } from '@/db/database';

export interface CaptureCategory {
  id: string;
  name: string;
  color: string | null;
}

const KIND_KEY = 'capture.kind';

export function createCaptureRepository(db: Database) {
  return {
    /** Categorías vigentes del tipo, con las usadas más recientemente primero. */
    listRecentCategories(kind: MovementKind) {
      return db.getAllAsync<CaptureCategory>(
        `SELECT c.id, c.name, c.color FROM category c
         LEFT JOIN (
           SELECT category_id, MAX(created_at) AS last_used
           FROM "transaction" WHERE deleted_at IS NULL GROUP BY category_id
         ) t ON t.category_id = c.id
         WHERE c.kind = ? AND c.archived = 0 AND c.deleted_at IS NULL
         ORDER BY t.last_used DESC, c.name COLLATE NOCASE`,
        kind,
      );
    },

    async getLastKind(): Promise<MovementKind | undefined> {
      const [row] = await db.getAllAsync<{ value: string }>(
        'SELECT value FROM app_settings WHERE key = ?',
        KIND_KEY,
      );
      return row?.value === 'income' || row?.value === 'expense' ? row.value : undefined;
    },

    setLastKind(kind: MovementKind) {
      return db.runAsync(
        'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        KIND_KEY,
        kind,
      );
    },
  };
}
