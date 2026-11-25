import type { Database } from '@/db/database';
import { migrate } from '@/db/migrate';

export { wipeLocalData } from '@/db/wipe-local-data';

interface Connection extends Database {
  closeAsync(): Promise<void>;
}

type OpenDatabase = (name: string) => Promise<Connection>;

/** Recibe openDatabaseAsync de expo-sqlite y comparte la conexión inicializada. */
export function createDatabaseClient(openDatabaseAsync: OpenDatabase): () => Promise<Database> {
  let ready: Promise<Database> | undefined;

  return () =>
    (ready ??= (async () => {
      const db = await openDatabaseAsync('bolsillo.db');
      try {
        await migrate(db);
        return db;
      } catch (error) {
        await db.closeAsync();
        throw error;
      }
    })().catch((error: unknown) => {
      ready = undefined;
      throw error;
    }));
}
