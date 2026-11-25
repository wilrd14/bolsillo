import { z } from 'zod';

import { AppError } from '@/core/errors';
import type { Database } from '@/db/database';
import { withDatabaseAccess } from '@/db/transaction';
import { createTransactionRepository } from '@/features/transactions/data/transaction-repository';

/** Devuelve un movimiento activo por id, o undefined si no existe o fue borrado. */
export async function getTransaction(db: Database, id: unknown) {
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) {
    throw new AppError('VALIDATION', 'Invalid transaction id', parsed.error);
  }
  return withDatabaseAccess(db, () => createTransactionRepository(db).findById(parsed.data));
}
