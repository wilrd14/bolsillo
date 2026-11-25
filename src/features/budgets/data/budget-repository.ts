import type { Database, StoredRow } from '@/db/database';
import { createLocalId } from '@/db/local-id';

export interface BudgetRow extends StoredRow {
  category_id: string;
  month: string;
  limit_minor: number;
  alerted_80: 0 | 1;
  alerted_100: 0 | 1;
}

export function createBudgetRepository(db: Database) {
  return {
    async findById(id: string) {
      const [row] = await db.getAllAsync<BudgetRow>(
        'SELECT * FROM budget WHERE id = ? AND deleted_at IS NULL',
        id,
      );
      return row;
    },
    async findByPeriod(categoryId: string, month: string) {
      const [row] = await db.getAllAsync<BudgetRow>(
        'SELECT * FROM budget WHERE category_id = ? AND month = ?',
        categoryId,
        month,
      );
      return row;
    },
    list(month: string) {
      return db.getAllAsync<BudgetRow>(
        'SELECT * FROM budget WHERE month = ? AND deleted_at IS NULL ORDER BY category_id',
        month,
      );
    },
    spending(month: string) {
      return db.getAllAsync<{ category_id: string; spent_minor: number }>(
        `SELECT t.category_id, SUM(t.amount_minor) AS spent_minor
         FROM budget b JOIN "transaction" t ON t.category_id = b.category_id
         WHERE b.month = ? AND b.deleted_at IS NULL
           AND t.occurred_at >= ? AND t.occurred_at < ?
           AND t.kind = 'expense' AND t.deleted_at IS NULL
         GROUP BY t.category_id`,
        month,
        `${month}-01`,
        `${month}-32`,
      );
    },
    insert(row: BudgetRow) {
      return db.runAsync(
        `INSERT INTO budget
         (id, category_id, month, limit_minor, alerted_80, alerted_100, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        row.id,
        row.category_id,
        row.month,
        row.limit_minor,
        row.alerted_80,
        row.alerted_100,
        row.created_at,
        row.updated_at,
      );
    },
    update(row: BudgetRow) {
      return db.runAsync(
        `UPDATE budget SET category_id = ?, month = ?, limit_minor = ?, alerted_80 = ?,
         alerted_100 = ?, updated_at = ?, deleted_at = ? WHERE id = ?`,
        row.category_id,
        row.month,
        row.limit_minor,
        row.alerted_80,
        row.alerted_100,
        row.updated_at,
        row.deleted_at,
        row.id,
      );
    },
    enqueue(row: BudgetRow) {
      return db.runAsync(
        `INSERT INTO outbox (id, entity, entity_id, op, payload, created_at)
         VALUES (?, 'budget', ?, ?, ?, ?)`,
        createLocalId(),
        row.id,
        row.deleted_at ? 'delete' : 'upsert',
        JSON.stringify(row),
        row.updated_at,
      );
    },
  };
}
