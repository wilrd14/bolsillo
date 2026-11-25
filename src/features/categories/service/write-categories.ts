import { z } from 'zod';

import { toIsoUtc } from '@/core/dates';
import { AppError } from '@/core/errors';
import type { Database } from '@/db/database';
import { createLocalId } from '@/db/local-id';
import { withDatabaseTransaction } from '@/db/transaction';
import { createCategoryRepository } from '@/features/categories/data/category-repository';
import { enqueueChange } from '@/sync/outbox';

const detailsSchema = z.strictObject({
  name: z.string().trim().min(1),
  icon: z.string().trim().min(1).nullish(),
  color: z.string().trim().min(1).nullish(),
});
const createSchema = detailsSchema.extend({ kind: z.enum(['expense', 'income']) });
const updateSchema = detailsSchema.partial();
const idSchema = z.uuid();

/** Crea una categoría personalizada activa. */
export async function createCategory(db: Database, input: unknown) {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError('VALIDATION', 'Invalid category', parsed.error);
  }
  const { icon, color, ...details } = parsed.data;

  return withDatabaseTransaction(db, async () => {
    const timestamp = toIsoUtc(new Date());
    const row = {
      ...details,
      id: createLocalId(),
      icon: icon ?? null,
      color: color ?? null,
      is_default: 0 as const,
      archived: 0 as const,
      created_at: timestamp,
      updated_at: timestamp,
      deleted_at: null,
    };
    await createCategoryRepository(db).insert(row);
    await enqueueChange(db, 'category', row);
    return row;
  });
}

/** Edita los detalles sin cambiar el tipo de los movimientos asociados. */
export async function updateCategory(db: Database, id: unknown, input: unknown) {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError('VALIDATION', 'Invalid category update', parsed.error);
  }
  return saveCategory(db, id, parsed.data);
}

/** Oculta una categoría sin borrar sus movimientos ni la categoría. */
export function archiveCategory(db: Database, id: unknown) {
  return saveCategory(db, id, { archived: 1 });
}

async function saveCategory(
  db: Database,
  id: unknown,
  patch: z.output<typeof updateSchema> & { archived?: 1 },
) {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) {
    throw new AppError('VALIDATION', 'Invalid category ID', parsed.error);
  }

  return withDatabaseTransaction(db, async () => {
    const repository = createCategoryRepository(db);
    const current = await repository.findById(parsed.data);
    if (!current) {
      throw new AppError('VALIDATION', 'Category does not exist');
    }
    const row = {
      ...current,
      name: patch.name ?? current.name,
      icon: patch.icon === undefined ? current.icon : patch.icon,
      color: patch.color === undefined ? current.color : patch.color,
      archived: patch.archived ?? current.archived,
      updated_at: toIsoUtc(new Date()),
    };
    await repository.update(row.id, row);
    await enqueueChange(db, 'category', row);
    return row;
  });
}
