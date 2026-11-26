import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { endOfWeek, formatDisplayDate, startOfWeek, toLocalDateKey } from '@/core/dates';
import { percentage } from '@/core/money';
import { es } from '@/core/strings/es';
import type { MovementKind } from '@/db/database';
import { useDatabase } from '@/db/provider';
import { listCategories, type CategoryRow } from '@/features/categories';
import { getPeriodReport, type PeriodReport } from '@/features/reports/service/reports';
import { listTransactions } from '@/features/transactions';

// shortcut: moneda fija hasta que exista Ajustes (T-019); entonces saldrá de la configuración.
export const DEFAULT_CURRENCY = 'DOP';
export const LOCALE = 'es-DO';

export type ReportPeriod = 'week' | 'month';

export interface CategoryShare {
  readonly id: string;
  readonly name: string;
  readonly color: string | null;
  readonly amountMinor: number;
  readonly percent: number;
}

export interface LatestMovement {
  readonly id: string;
  readonly kind: MovementKind;
  readonly amountMinor: number;
  readonly currency: string;
  readonly title: string;
  readonly categoryName: string;
  readonly categoryColor: string | null;
  readonly dateLabel: string;
}

export const LATEST_LIMIT = 5;
export const TOP_CATEGORIES = 3;

export function monthLabel(dateKey: string): string {
  const [year, month] = dateKey.split('-');
  return `${es.transactions.months[Number(month) - 1]} ${year}`;
}

/** Suma días a una clave AAAA-MM-DD sin zonas horarias. */
function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Desplaza la fecha de referencia una semana o un mes (en meses cae siempre en el día 1). */
export function shiftAnchor(dateKey: string, period: ReportPeriod, delta: number): string {
  if (period === 'week') return addDays(dateKey, 7 * delta);
  const [y, m] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 10);
}

export function periodLabel(dateKey: string, period: ReportPeriod): string {
  if (period === 'month') return monthLabel(dateKey);
  const anchor = new Date(dateKey);
  return `${formatDisplayDate(startOfWeek(anchor))} - ${formatDisplayDate(endOfWeek(anchor))}`;
}

type TransactionList = Awaited<ReturnType<typeof listTransactions>>;

/** Cargador compartido: totales del periodo, desglose de gastos y (opcional) últimos movimientos. */
function useReportData(period: ReportPeriod, date: string, withLatest: boolean) {
  const db = useDatabase();
  const [report, setReport] = useState<PeriodReport | null>(null);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [latestRows, setLatestRows] = useState<TransactionList>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const alive = useRef(true);
  const request = useRef(0);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    const current = ++request.current;
    try {
      const [next, cats, latest] = await Promise.all([
        getPeriodReport(db, { period, date }),
        listCategories(db),
        withLatest
          ? listTransactions(db, { limit: LATEST_LIMIT, offset: 0 })
          : Promise.resolve([] as TransactionList),
      ]);
      if (current !== request.current || !alive.current) return;
      setReport(next);
      setCategories(cats);
      setLatestRows(latest);
      setStatus('ready');
    } catch {
      if (current === request.current && alive.current) setStatus('error');
    }
  }, [db, period, date, withLatest]);

  const retry = useCallback(() => {
    setStatus('loading');
    void reload();
  }, [reload]);

  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const shares = useMemo<CategoryShare[]>(() => {
    if (!report || report.expense_minor <= 0) return [];
    return report.breakdown
      .filter((item) => item.kind === 'expense')
      .map((item) => {
        const category = byId.get(item.category_id);
        return {
          id: item.category_id,
          name: category?.name ?? es.transactions.uncategorized,
          color: category?.color ?? null,
          amountMinor: item.amount_minor,
          percent: percentage(item.amount_minor, report.expense_minor),
        };
      });
  }, [report, byId]);

  const latest = useMemo<LatestMovement[]>(
    () =>
      latestRows.map((row) => {
        const category = byId.get(row.category_id);
        const categoryName = category?.name ?? es.transactions.uncategorized;
        return {
          id: row.id,
          kind: row.kind,
          amountMinor: row.amount_minor,
          currency: row.currency,
          title: row.merchant || row.note || categoryName,
          categoryName,
          categoryColor: category?.color ?? null,
          dateLabel: formatDisplayDate(row.occurred_at),
        };
      }),
    [latestRows, byId],
  );

  return { status, report, shares, latest, refresh: reload, retry };
}

/** ViewModel de Inicio: mes actual (fecha local de hoy) y últimos 5 movimientos. */
export function useHome() {
  // La fecha se fija al montar; para cambiar de mes con la app abierta basta con reabrirla.
  const [today] = useState(() => toLocalDateKey(new Date()));
  const data = useReportData('month', today, true);
  return {
    ...data,
    monthLabel: monthLabel(today),
    topShares: data.shares.slice(0, TOP_CATEGORIES),
  };
}

/** ViewModel del resumen ampliado: selector semana/mes y navegación entre periodos. */
export function useSummary() {
  const [period, setPeriod] = useState<ReportPeriod>('month');
  const [date, setDate] = useState(() => toLocalDateKey(new Date()));
  const data = useReportData(period, date, false);
  return {
    ...data,
    period,
    setPeriod,
    label: periodLabel(date, period),
    shift: (delta: number) => setDate((current) => shiftAnchor(current, period, delta)),
  };
}
