import type { Database } from '@/db/database';

const pending = new WeakMap<Database, Promise<unknown>>();

/** Ordena el acceso de los servicios a una conexión compartida. */
export async function withDatabaseAccess<Result>(
  db: Database,
  operation: () => Promise<Result>,
): Promise<Result> {
  const previous = pending.get(db);
  const current = (async () => {
    await previous?.catch(() => undefined);
    return operation();
  })();

  pending.set(db, current);
  try {
    return await current;
  } finally {
    if (pending.get(db) === current) {
      pending.delete(db);
    }
  }
}

/** Ejecuta un cambio y sus efectos locales en una sola transacción. */
export function withDatabaseTransaction<Result>(
  db: Database,
  operation: () => Promise<Result>,
): Promise<Result> {
  return withDatabaseAccess(db, async () => {
    await db.execAsync('BEGIN IMMEDIATE;');
    try {
      const result = await operation();
      await db.execAsync('COMMIT;');
      return result;
    } catch (error) {
      await db.execAsync('ROLLBACK;');
      throw error;
    }
  });
}
