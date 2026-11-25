export type SqlValue = string | number | null;

export interface Database {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: SqlValue[]): Promise<{ changes: number }>;
  getAllAsync<Row>(sql: string, ...params: SqlValue[]): Promise<Row[]>;
}

export type MovementKind = 'expense' | 'income';

export interface StoredRow {
  id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Page {
  limit: number;
  offset: number;
}
