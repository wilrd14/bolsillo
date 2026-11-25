import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { percentage, sumMoney } from '@/core/money';
import { es } from '@/core/strings/es';
import { listCategories, type CategoryRow } from '@/features/categories';
import { useDatabase } from '@/db/provider';
import {
  createBudget,
  deleteBudget,
  listBudgetProgress,
  updateBudget,
  type BudgetProgress,
} from '@/features/budgets/service/budgets';

export type { BudgetProgress };

export const DEFAULT_CURRENCY = 'DOP';
export const LOCALE = 'es-DO';

export interface BudgetDraft {
  readonly category_id: string;
  readonly limit_minor: number;
}

export function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function shiftMonthKey(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split('-').map(Number);
  const index = year * 12 + (month - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

export function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  return `${es.transactions.months[month - 1]} ${year}`;
}

/** Días restantes del mes UTC; negativo o 0 para meses ya cerrados. */
export function daysLeftInMonth(monthKey: string): number {
  const [year, month] = monthKey.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return lastDay - new Date().getUTCDate();
}

/** ViewModel de la pantalla Presupuestos: mes, lista y alta/edición/eliminación. */
export function useBudgets() {
  const db = useDatabase();
  const [month, setMonth] = useState(currentMonthKey);
  const [budgets, setBudgets] = useState<BudgetProgress[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [saveError, setSaveError] = useState(false);
  const alive = useRef(true);

  const reload = useCallback(async () => {
    try {
      const [progress, cats] = await Promise.all([
        listBudgetProgress(db, month),
        listCategories(db),
      ]);
      if (!alive.current) return;
      setBudgets(progress);
      setCategories(cats);
      setStatus('ready');
    } catch {
      if (alive.current) setStatus('error');
    }
  }, [db, month]);

  useEffect(() => {
    alive.current = true;
    // Diferido para no llamar a setState de forma síncrona dentro del efecto.
    void Promise.resolve().then(reload);
    return () => {
      alive.current = false;
    };
  }, [reload]);

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

  const activeCategories = useMemo(
    () => categories.filter((cat) => cat.kind === 'expense' && !cat.archived),
    [categories],
  );

  const totalAssigned = sumMoney(budgets.map((budget) => budget.limit_minor));
  const totalSpent = sumMoney(budgets.map((budget) => budget.spent_minor));
  const totalRemaining = sumMoney(budgets.map((budget) => budget.remaining_minor));
  const currentMonth = month === currentMonthKey();

  return {
    month,
    setMonth,
    shiftMonth: (delta: number) => setMonth(shiftMonthKey(month, delta)),
    status,
    budgets,
    categories: activeCategories,
    totalAssigned,
    totalSpent,
    totalRemaining,
    currentMonth,
    daysLeft: currentMonth ? daysLeftInMonth(month) : null,
    executedPercent: totalAssigned > 0 ? percentage(totalSpent, totalAssigned) : 0,
    create: (draft: BudgetDraft) => run(() => createBudget(db, { ...draft, month })),
    update: (id: string, draft: BudgetDraft) => run(() => updateBudget(db, id, draft)),
    delete: (id: string) => run(() => deleteBudget(db, id)),
    saveError,
    retry: () => {
      setStatus('loading');
      void reload();
    },
  };
}
