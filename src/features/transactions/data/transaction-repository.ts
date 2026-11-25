import type { Database, MovementKind, Page, SqlValue, StoredRow } from '@/db/database';

export interface TransactionRow extends StoredRow {
  kind: MovementKind;
  amount_minor: number;
  currency: string;
  category_id: string;
  merchant: string | null;
  note: string | null;
  occurred_at: string;
  receipt_id: string | null;
  recurring_id: string | null;
  occurrence_index: number | null;
}

export interface TransactionFilters extends Page {
  includeDeleted?: boolean;
  kind?: MovementKind;
  categoryId?: string;
  from?: string;
  to?: string;
  search?: string;
}

type NewTransaction = Omit<TransactionRow, 'deleted_at'>;
type TransactionUpdate = Omit<NewTransaction, 'id' | 'created_at'>;

export function createTransactionRepository(db: Database) {
  return {
    insert(row: NewTransaction) {
      return db.runAsync(
        `INSERT INTO "transaction" (
          id, kind, amount_minor, currency, category_id, merchant,
          note, occurred_at, receipt_id, recurring_id, occurrence_index, created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        row.id,
        row.kind,
        row.amount_minor,
        row.currency,
        row.category_id,
        row.merchant,
        row.note,
        row.occurred_at,
        row.receipt_id,
        row.recurring_id,
        row.occurrence_index,
        row.created_at,
        row.updated_at,
      );
    },

    update(id: string, row: TransactionUpdate) {
      return db.runAsync(
        `UPDATE "transaction" SET
          kind = ?, amount_minor = ?, currency = ?, category_id = ?, merchant = ?,
          note = ?, occurred_at = ?, receipt_id = ?, recurring_id = ?, occurrence_index = ?,
          updated_at = ?
          WHERE id = ? AND deleted_at IS NULL`,
        row.kind,
        row.amount_minor,
        row.currency,
        row.category_id,
        row.merchant,
        row.note,
        row.occurred_at,
        row.receipt_id,
        row.recurring_id,
        row.occurrence_index,
        row.updated_at,
        id,
      );
    },

    softDelete(id: string, timestamp: string) {
      return db.runAsync(
        `UPDATE "transaction" SET deleted_at = ?, updated_at = ?
          WHERE id = ? AND deleted_at IS NULL`,
        timestamp,
        timestamp,
        id,
      );
    },

    list(filters: TransactionFilters) {
      const conditions = filters.includeDeleted ? [] : ['deleted_at IS NULL'];
      const params: SqlValue[] = [];

      if (filters.kind !== undefined) {
        conditions.push('kind = ?');
        params.push(filters.kind);
      }
      if (filters.categoryId !== undefined) {
        conditions.push('category_id = ?');
        params.push(filters.categoryId);
      }
      if (filters.from !== undefined) {
        conditions.push('occurred_at >= ?');
        params.push(filters.from);
      }
      if (filters.to !== undefined) {
        conditions.push('occurred_at <= ?');
        params.push(filters.to);
      }
      if (filters.search !== undefined) {
        conditions.push(
          '(instr(lower(merchant), lower(?)) > 0 OR instr(lower(note), lower(?)) > 0)',
        );
        params.push(filters.search, filters.search);
      }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      return db.getAllAsync<TransactionRow>(
        `SELECT * FROM "transaction" ${where}
          ORDER BY occurred_at DESC, id DESC LIMIT ? OFFSET ?`,
        ...params,
        filters.limit,
        filters.offset,
      );
    },
  };
}
