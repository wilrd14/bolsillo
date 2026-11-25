import type { Database, MovementKind } from '@/db/database';

export interface CategoryTotal {
  category_id: string;
  kind: MovementKind;
  amount_minor: number;
}

export function listCategoryTotals(db: Database, from: string, until: string) {
  return db.getAllAsync<CategoryTotal>(
    `SELECT category_id, kind, SUM(amount_minor) AS amount_minor
     FROM "transaction"
     WHERE deleted_at IS NULL AND occurred_at >= ? AND occurred_at < ?
     GROUP BY category_id, kind
     ORDER BY amount_minor DESC, category_id, kind`,
    from,
    until,
  );
}
