import { useCallback, useEffect, useState } from 'react';

import { AppError } from '@/core/errors';
import { es } from '@/core/strings/es';
import type { MovementKind } from '@/db/database';
import { useDatabase } from '@/db/provider';
import { listCategories, type CategoryRow } from '@/features/categories';
import { getTransaction } from '@/features/transactions/service/get-transaction';
import {
  deleteTransaction,
  updateTransaction,
} from '@/features/transactions/service/write-transactions';

export type DetailStatus = 'loading' | 'ready' | 'missing' | 'error';

/** ViewModel del detalle y edición de un movimiento. */
export function useTransactionDetail(id: string) {
  const db = useDatabase();
  const [status, setStatus] = useState<DetailStatus>('loading');
  const [kind, setKind] = useState<MovementKind>('expense');
  const [currency, setCurrency] = useState('');
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [amountMinor, setAmountMinor] = useState(0);
  const [categoryId, setCategoryId] = useState('');
  const [merchant, setMerchant] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      const [row, cats] = await Promise.all([getTransaction(db, id), listCategories(db)]);
      if (!active) return;
      if (!row) {
        setStatus('missing');
        return;
      }
      setKind(row.kind);
      setCurrency(row.currency);
      setAmountMinor(row.amount_minor);
      setCategoryId(row.category_id);
      setMerchant(row.merchant ?? '');
      setNote(row.note ?? '');
      setDate(row.occurred_at);
      // Solo categorías del mismo tipo, activas o la que ya tiene el movimiento.
      setCategories(
        cats.filter(
          (category) =>
            category.kind === row.kind && (!category.archived || category.id === row.category_id),
        ),
      );
      setStatus('ready');
    })().catch(() => active && setStatus('error'));
    return () => {
      active = false;
    };
  }, [db, id, reloadKey]);

  const run = useCallback(async (action: () => Promise<unknown>) => {
    setSaving(true);
    setError(null);
    try {
      await action();
      setDone(true);
    } catch (cause) {
      setError(cause instanceof AppError ? es.errors[cause.code] : es.recoverableError);
    } finally {
      setSaving(false);
    }
  }, []);

  const save = useCallback(
    () =>
      run(() =>
        updateTransaction(db, id, {
          amount_minor: amountMinor,
          category_id: categoryId,
          merchant: merchant.trim() === '' ? null : merchant,
          note: note.trim() === '' ? null : note,
          occurred_at: date,
        }),
      ),
    [run, db, id, amountMinor, categoryId, merchant, note, date],
  );

  const remove = useCallback(() => run(() => deleteTransaction(db, id)), [run, db, id]);

  return {
    status,
    retry: () => {
      setStatus('loading');
      setReloadKey((key) => key + 1);
    },
    kind,
    currency,
    categories,
    amountMinor,
    setAmountMinor,
    categoryId,
    setCategoryId,
    merchant,
    setMerchant,
    note,
    setNote,
    date,
    setDate,
    canSave: status === 'ready' && !saving && amountMinor > 0 && categoryId !== '',
    saving,
    save,
    remove,
    error,
    done,
  };
}
