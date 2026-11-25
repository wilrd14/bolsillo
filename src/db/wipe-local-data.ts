import type { Database } from '@/db/database';
import { withDatabaseTransaction } from '@/db/transaction';

/** Vacía las tablas locales conservando el esquema y su versión. */
export function wipeLocalData(db: Database): Promise<void> {
  return withDatabaseTransaction(db, () =>
    db.execAsync(`
      DELETE FROM "transaction";
      DELETE FROM budget;
      DELETE FROM recurring_rule;
      DELETE FROM receipt;
      DELETE FROM category;
      DELETE FROM outbox;
      DELETE FROM app_settings;
    `),
  );
}
