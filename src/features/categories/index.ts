import type { Database } from '@/db/database';
import { createCategoryRepository } from './data/category-repository';

/** API pública de categorías. */
export { archiveCategory, createCategory, updateCategory } from './service/write-categories';

/** Busca una categoría vigente, aunque esté archivada. */
export function findCategoryById(db: Database, id: string) {
  return createCategoryRepository(db).findById(id);
}
