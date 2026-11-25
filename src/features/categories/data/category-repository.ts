import type { Database, MovementKind, Page, SqlValue, StoredRow } from '@/db/database';

export interface CategoryRow extends StoredRow {
  name: string;
  kind: MovementKind;
  icon: string | null;
  color: string | null;
  is_default: 0 | 1;
  archived: 0 | 1;
}

export interface CategoryFilters extends Page {
  includeDeleted?: boolean;
  kind?: MovementKind;
  archived?: 0 | 1;
  search?: string;
}

type NewCategory = Omit<CategoryRow, 'deleted_at'>;
type CategoryUpdate = Omit<NewCategory, 'id' | 'created_at'>;

export function createCategoryRepository(db: Database) {
  return {
    insert(row: NewCategory) {
      return db.runAsync(
        `INSERT INTO category (
          id, name, kind, icon, color, is_default,
          archived, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        row.id,
        row.name,
        row.kind,
        row.icon,
        row.color,
        row.is_default,
        row.archived,
        row.created_at,
        row.updated_at,
      );
    },

    update(id: string, row: CategoryUpdate) {
      return db.runAsync(
        `UPDATE category SET
          name = ?, kind = ?, icon = ?, color = ?, is_default = ?,
          archived = ?, updated_at = ?
          WHERE id = ? AND deleted_at IS NULL`,
        row.name,
        row.kind,
        row.icon,
        row.color,
        row.is_default,
        row.archived,
        row.updated_at,
        id,
      );
    },

    softDelete(id: string, timestamp: string) {
      return db.runAsync(
        `UPDATE category SET deleted_at = ?, updated_at = ?
          WHERE id = ? AND deleted_at IS NULL`,
        timestamp,
        timestamp,
        id,
      );
    },

    list(filters: CategoryFilters) {
      const conditions = filters.includeDeleted ? [] : ['deleted_at IS NULL'];
      const params: SqlValue[] = [];

      if (filters.kind !== undefined) {
        conditions.push('kind = ?');
        params.push(filters.kind);
      }
      if (filters.archived !== undefined) {
        conditions.push('archived = ?');
        params.push(filters.archived);
      }
      if (filters.search !== undefined) {
        conditions.push('instr(lower(name), lower(?)) > 0');
        params.push(filters.search);
      }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      return db.getAllAsync<CategoryRow>(
        `SELECT * FROM category ${where}
          ORDER BY name COLLATE NOCASE, id LIMIT ? OFFSET ?`,
        ...params,
        filters.limit,
        filters.offset,
      );
    },
  };
}
