import { z } from 'zod';

import { AppError } from '@/core/errors';
import type { Database } from '@/db/database';
import { withDatabaseAccess } from '@/db/transaction';
import { createTransactionRepository } from '@/features/transactions/data/transaction-repository';

const filtersSchema = z
  .object({
    limit: z.int().positive(),
    offset: z.int().nonnegative(),
    kind: z.enum(['expense', 'income']).optional(),
    categoryId: z.uuid().optional(),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
    search: z.string().optional(),
  })
  .refine(({ from, to }) => !from || !to || from <= to);

/** Lista movimientos activos con filtros inclusivos de fecha y paginación. */
export async function listTransactions(db: Database, filters: unknown) {
  const result = filtersSchema.safeParse(filters);
  if (!result.success) {
    throw new AppError('VALIDATION', 'Invalid transaction filters', result.error);
  }

  return withDatabaseAccess(db, () => createTransactionRepository(db).list(result.data));
}
