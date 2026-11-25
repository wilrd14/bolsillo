import type { Database } from '@/db/database';

const DEFAULTS = [
  ['4765444e-b400-4ec3-9b6e-6ed0950edcd1', 'Comida', 'expense'],
  ['5dc9d1cc-e758-47a6-a6ce-c98605823a52', 'Transporte', 'expense'],
  ['fddd4535-7811-46dc-bc03-d0065a6af81d', 'Salario', 'income'],
] as const;

/** Siembra las categorías predefinidas solo si la tabla está vacía (p. ej. tras wipeLocalData). */
export async function ensureDefaultCategories(db: Database): Promise<void> {
  const [row] = await db.getAllAsync<{ total: number }>('SELECT COUNT(*) AS total FROM category');
  if (row.total > 0) return;
  const now = new Date().toISOString();
  for (const [id, name, kind] of DEFAULTS) {
    await db.runAsync(
      `INSERT OR IGNORE INTO category (id, name, kind, is_default, created_at, updated_at)
       VALUES (?, ?, ?, 1, ?, ?)`,
      id,
      name,
      kind,
      now,
      now,
    );
  }
}
