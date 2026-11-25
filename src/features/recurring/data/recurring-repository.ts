import type { Database, MovementKind, StoredRow } from '@/db/database';

export interface RecurringRule extends StoredRow {
  kind: MovementKind;
  amount_minor: number;
  category_id: string;
  frequency: 'weekly' | 'monthly' | 'yearly';
  next_due: string;
  remind_days_before: number;
  active: 0 | 1;
}

export function createRecurringRepository(db: Database) {
  return {
    list: () =>
      db.getAllAsync<RecurringRule>(
        'SELECT * FROM recurring_rule WHERE deleted_at IS NULL ORDER BY next_due, id',
      ),
    async find(id: string) {
      const [row] = await db.getAllAsync<RecurringRule>(
        'SELECT * FROM recurring_rule WHERE id = ? AND deleted_at IS NULL',
        id,
      );
      return row;
    },
    insert: (row: RecurringRule) =>
      db.runAsync(
        `INSERT INTO recurring_rule
          (id, kind, amount_minor, category_id, frequency, next_due, remind_days_before,
           active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        row.id,
        row.kind,
        row.amount_minor,
        row.category_id,
        row.frequency,
        row.next_due,
        row.remind_days_before,
        row.active,
        row.created_at,
        row.updated_at,
      ),
    update: (row: RecurringRule) =>
      db.runAsync(
        `UPDATE recurring_rule SET kind = ?, amount_minor = ?, category_id = ?, frequency = ?,
          next_due = ?, remind_days_before = ?, active = ?, updated_at = ? WHERE id = ?`,
        row.kind,
        row.amount_minor,
        row.category_id,
        row.frequency,
        row.next_due,
        row.remind_days_before,
        row.active,
        row.updated_at,
        row.id,
      ),
    async anchorDay(row: RecurringRule) {
      await db.runAsync(
        'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING',
        `recurring.anchor.${row.id}`,
        row.next_due.slice(8),
      );
      const [setting] = await db.getAllAsync<{ value: string }>(
        'SELECT value FROM app_settings WHERE key = ?',
        `recurring.anchor.${row.id}`,
      );
      return Number(setting.value);
    },
    setAnchor: (row: RecurringRule) =>
      db.runAsync(
        `INSERT INTO app_settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        `recurring.anchor.${row.id}`,
        row.next_due.slice(8),
      ),
    async nextIndex(id: string) {
      const [row] = await db.getAllAsync<{ next_index: number }>(
        `SELECT COALESCE(MAX(occurrence_index) + 1, 0) AS next_index
         FROM "transaction" WHERE recurring_id = ?`,
        id,
      );
      return row.next_index;
    },
    insertOccurrence: (
      row: StoredRow & {
        kind: MovementKind;
        amount_minor: number;
        currency: string;
        category_id: string;
        occurred_at: string;
        recurring_id: string;
        occurrence_index: number;
      },
    ) =>
      db.runAsync(
        `INSERT INTO "transaction"
          (id, kind, amount_minor, currency, category_id, occurred_at, recurring_id,
           occurrence_index, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(recurring_id, occurrence_index) DO NOTHING`,
        row.id,
        row.kind,
        row.amount_minor,
        row.currency,
        row.category_id,
        row.occurred_at,
        row.recurring_id,
        row.occurrence_index,
        row.created_at,
        row.updated_at,
      ),
  };
}
