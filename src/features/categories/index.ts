import type { Database } from '@/db/database';
import { createCategoryRepository } from './data/category-repository';

/** API pública de categorías. */
export { archiveCategory, createCategory, updateCategory } from './service/write-categories';

export { CategoriesScreen } from './ui/CategoriesScreen';
export type { CategoryRow } from './data/category-repository';

/** Lista las categorías vigentes (activas y archivadas) para nombres y filtros. */
export function listCategories(db: Database) {
  return createCategoryRepository(db).list({ limit: 500, offset: 0 });
}

/** Busca una categoría vigente, aunque esté archivada. */
export function findCategoryById(db: Database, id: string) {
  return createCategoryRepository(db).findById(id);
}
