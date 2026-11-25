import type { Database } from '@/db/database';
import { INITIAL_SCHEMA } from '@/db/migrations/001-initial';

const MIGRATIONS = [INITIAL_SCHEMA];

/** Aplica las versiones pendientes y registra la versión en la misma transacción. */
export async function migrate(db: Database): Promise<void> {
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await db.execAsync('BEGIN IMMEDIATE;');
  try {
    const [current] = await db.getAllAsync<{ user_version: number }>('PRAGMA user_version;');
    if (current.user_version > MIGRATIONS.length) {
      throw new Error('Unsupported SQLite schema version');
    }

    for (let index = current.user_version; index < MIGRATIONS.length; index += 1) {
      await db.execAsync(MIGRATIONS[index]);
      await db.execAsync(`PRAGMA user_version = ${index + 1};`);
    }

    await db.execAsync('COMMIT;');
  } catch (error) {
    await db.execAsync('ROLLBACK;');
    throw error;
  }
}
