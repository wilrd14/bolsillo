import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { es } from '@/core/strings/es';
import type { MovementKind } from '@/db/database';
import { useDatabase } from '@/db/provider';
import { listCategories, type CategoryRow } from '@/features/categories';
import { listTransactions } from '@/features/transactions/service/list-transactions';
import { deleteTransaction } from '@/features/transactions/service/write-transactions';

export const PAGE_SIZE = 30;
export const UNDO_MS = 5000;

type Row = Awaited<ReturnType<typeof listTransactions>>[number];

export interface TransactionFiltersState {
  search: string;
  kind: MovementKind | null;
  categoryId: string | null;
  /** AAAA-MM o null para todos los meses. */
  month: string | null;
}

export type ListItem =
  | { type: 'header'; key: string; label: string }
  | {
      type: 'row';
      key: string;
      id: string;
      kind: MovementKind;
      amountMinor: number;
      currency: string;
      title: string;
      categoryName: string;
      categoryColor: string | null;
      dateLabel: string;
    };

const INITIAL_FILTERS: TransactionFiltersState = {
  search: '',
  kind: null,
  categoryId: null,
  month: null,
};

/** "2026-11-24" -> "24 de noviembre de 2026" sin APIs de Intl. */
export function formatDay(dateKey: string): string {
  const [year, month, day] = dateKey.split('-');
  return `${Number(day)} de ${es.transactions.months[Number(month) - 1]} de ${year}`;
}

export function formatMonth(monthKey: string): string {
  const [year, month] = monthKey.split('-');
  return `${es.transactions.months[Number(month) - 1]} ${year}`;
}

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function shiftMonthKey(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split('-').map(Number);
  const index = year * 12 + (month - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

function toQuery(filters: TransactionFiltersState, offset: number) {
  const query: Record<string, unknown> = { limit: PAGE_SIZE, offset };
  const search = filters.search.trim();
  if (search) query.search = search;
  if (filters.kind) query.kind = filters.kind;
  if (filters.categoryId) query.categoryId = filters.categoryId;
  if (filters.month) {
    const [year, month] = filters.month.split('-').map(Number);
    query.from = `${filters.month}-01`;
    // Día 0 del mes siguiente = último día de este mes.
    query.to = `${filters.month}-${String(new Date(Date.UTC(year, month, 0)).getUTCDate())}`;
  }
  return query;
}

/** ViewModel de la lista de movimientos: filtros, paginación y borrado con deshacer. */
export function useTransactions() {
  const db = useDatabase();
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [rows, setRows] = useState<Row[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState(false);
  const request = useRef(0);
  const pendingRef = useRef<{ id: string; timer: ReturnType<typeof setTimeout> } | null>(null);
  const alive = useRef(true);

  const reload = useCallback(async () => {
    const current = ++request.current;
    try {
      const [page, cats] = await Promise.all([
        listTransactions(db, toQuery(filters, 0)),
        listCategories(db),
      ]);
      if (current !== request.current || !alive.current) return;
      setRows(page);
      setCategories(cats);
      setHasMore(page.length === PAGE_SIZE);
      setStatus('ready');
    } catch {
      if (current === request.current && alive.current) setStatus('error');
    }
  }, [db, filters]);

  useEffect(() => {
    // Diferido para no llamar a setState de forma síncrona dentro del efecto.
    void Promise.resolve().then(reload);
  }, [reload]);

  const commitDelete = useCallback(
    async (id: string) => {
      if (pendingRef.current?.id === id) {
        clearTimeout(pendingRef.current.timer);
        pendingRef.current = null;
      }
      try {
        await deleteTransaction(db, id);
        if (!alive.current) return;
        setRows((previous) => previous.filter((row) => row.id !== id));
      } catch {
        if (alive.current) setDeleteError(true);
      }
      if (alive.current) setPendingId((current) => (current === id ? null : current));
    },
    [db],
  );

  // Al salir de la pantalla se confirma el borrado pendiente.
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (pendingRef.current) {
        clearTimeout(pendingRef.current.timer);
        void deleteTransaction(db, pendingRef.current.id).catch(() => undefined);
      }
    };
  }, [db]);

  const requestDelete = useCallback(
    (id: string) => {
      if (pendingRef.current) void commitDelete(pendingRef.current.id);
      setDeleteError(false);
      pendingRef.current = { id, timer: setTimeout(() => void commitDelete(id), UNDO_MS) };
      setPendingId(id);
    },
    [commitDelete],
  );

  const undoDelete = useCallback(() => {
    if (pendingRef.current) clearTimeout(pendingRef.current.timer);
    pendingRef.current = null;
    setPendingId(null);
  }, []);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || status !== 'ready') return;
    setLoadingMore(true);
    const current = request.current;
    try {
      const page = await listTransactions(db, toQuery(filters, rows.length));
      if (current !== request.current || !alive.current) return;
      setRows((previous) => [...previous, ...page]);
      setHasMore(page.length === PAGE_SIZE);
    } catch {
      if (alive.current) setStatus('error');
    } finally {
      if (alive.current) setLoadingMore(false);
    }
  }, [db, filters, hasMore, loadingMore, rows.length, status]);

  const update = useCallback(
    (patch: Partial<TransactionFiltersState>) =>
      setFilters((previous) => ({ ...previous, ...patch })),
    [],
  );

  const items = useMemo<ListItem[]>(() => {
    const byId = new Map(categories.map((category) => [category.id, category]));
    const result: ListItem[] = [];
    let lastDay = '';
    for (const row of rows) {
      if (row.id === pendingId) continue;
      if (row.occurred_at !== lastDay) {
        lastDay = row.occurred_at;
        result.push({ type: 'header', key: `h-${lastDay}`, label: formatDay(lastDay) });
      }
      const category = byId.get(row.category_id);
      const categoryName = category?.name ?? es.transactions.uncategorized;
      result.push({
        type: 'row',
        key: row.id,
        id: row.id,
        kind: row.kind,
        amountMinor: row.amount_minor,
        currency: row.currency,
        title: row.merchant || row.note || categoryName,
        categoryName,
        categoryColor: category?.color ?? null,
        dateLabel: row.occurred_at,
      });
    }
    return result;
  }, [rows, categories, pendingId]);

  const visibleCategories = useMemo(
    () =>
      categories.filter(
        (category) => !category.archived && (!filters.kind || category.kind === filters.kind),
      ),
    [categories, filters.kind],
  );
  const hasFilters =
    filters.search.trim() !== '' || !!filters.kind || !!filters.categoryId || !!filters.month;

  return {
    filters,
    setSearch: (search: string) => update({ search }),
    // Cambiar el tipo invalida la categoría elegida (pertenece a un tipo).
    setKind: (kind: MovementKind | null) => update({ kind, categoryId: null }),
    setCategoryId: (categoryId: string | null) => update({ categoryId }),
    setMonth: (month: string | null) => update({ month }),
    thisMonth: () => update({ month: currentMonthKey() }),
    shiftMonth: (delta: number) =>
      update({ month: shiftMonthKey(filters.month ?? currentMonthKey(), delta) }),
    clearFilters: () => setFilters(INITIAL_FILTERS),
    hasFilters,
    categories: visibleCategories,
    items,
    status,
    retry: () => {
      setStatus('loading');
      void reload();
    },
    refresh: reload,
    hasMore,
    loadingMore,
    loadMore,
    requestDelete,
    undoDelete,
    undoVisible: pendingId !== null,
    deleteError,
  };
}
