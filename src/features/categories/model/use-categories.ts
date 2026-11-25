import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { MovementKind } from '@/db/database';
import { useDatabase } from '@/db/provider';
import {
  archiveCategory,
  createCategory,
  listCategories,
  updateCategory,
  type CategoryRow,
} from '@/features/categories';

export interface CategoryDraft {
  name: string;
  icon: string;
  color: string;
}

/** Iconos Ionicons y colores ofrecidos; el nombre siempre acompaña a ambos. */
export const ICON_OPTIONS = [
  'restaurant',
  'cart',
  'car',
  'bus',
  'home',
  'medkit',
  'school',
  'game-controller',
  'shirt',
  'airplane',
  'gift',
  'paw',
  'cash',
  'briefcase',
  'trending-up',
  'ellipsis-horizontal',
] as const;
export const COLOR_OPTIONS = [
  '#0F766E',
  '#B91C1C',
  '#B45309',
  '#15803D',
  '#1D4ED8',
  '#7E22CE',
  '#BE185D',
  '#475569',
] as const;

export const EMPTY_DRAFT: CategoryDraft = {
  name: '',
  icon: ICON_OPTIONS[0],
  color: COLOR_OPTIONS[0],
};

/** ViewModel de categorías: lista por tipo, alta, edición y archivado. */
export function useCategories() {
  const db = useDatabase();
  const [all, setAll] = useState<CategoryRow[]>([]);
  const [kind, setKind] = useState<MovementKind>('expense');
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [saveError, setSaveError] = useState(false);
  const alive = useRef(true);

  const reload = useCallback(async () => {
    try {
      const rows = await listCategories(db);
      if (!alive.current) return;
      setAll(rows);
      setStatus('ready');
    } catch {
      if (alive.current) setStatus('error');
    }
  }, [db]);

  useEffect(() => {
    alive.current = true;
    // Diferido para no llamar a setState de forma síncrona dentro del efecto.
    void Promise.resolve().then(reload);
    return () => {
      alive.current = false;
    };
  }, [reload]);

  const items = useMemo(() => all.filter((c) => c.kind === kind && !c.archived), [all, kind]);

  /** Ejecuta una escritura y recarga; devuelve false si falla. */
  const run = useCallback(
    async (write: () => Promise<unknown>) => {
      setSaveError(false);
      try {
        await write();
        await reload();
        return true;
      } catch {
        if (alive.current) setSaveError(true);
        return false;
      }
    },
    [reload],
  );

  return {
    kind,
    setKind,
    items,
    status,
    saveError,
    retry: () => {
      setStatus('loading');
      void reload();
    },
    create: (draft: CategoryDraft) => run(() => createCategory(db, { ...draft, kind })),
    update: (id: string, draft: CategoryDraft) => run(() => updateCategory(db, id, draft)),
    archive: (id: string) => run(() => archiveCategory(db, id)),
  };
}
