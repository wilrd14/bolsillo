import { useCallback, useEffect, useState } from 'react';

import { toDateKey } from '@/core/dates';
import { AppError } from '@/core/errors';
import { es } from '@/core/strings/es';
import type { MovementKind } from '@/db/database';
import { useDatabase } from '@/db/provider';
import {
  listCaptureCategories,
  loadLastKind,
  rememberKind,
  saveCapture,
  type CaptureCategory,
} from '@/features/capture/service/capture-service';

// Moneda por defecto pendiente de decisión (PRD §14): se centraliza aquí.
export const DEFAULT_CURRENCY = 'DOP';

export type CaptureStatus = 'loading' | 'ready' | 'error';

function localDateKey(): string {
  const now = new Date();
  return toDateKey(new Date(now.getTime() - now.getTimezoneOffset() * 60_000));
}

/** ViewModel de la pantalla de captura rápida. */
export function useCreateTransaction() {
  const db = useDatabase();
  const [kind, setKindState] = useState<MovementKind | null>(null);
  const [categories, setCategories] = useState<CaptureCategory[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [amountMinor, setAmountMinor] = useState(0);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(localDateKey);
  const [status, setStatus] = useState<CaptureStatus>('loading');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      const current = kind ?? (await loadLastKind(db));
      const list = await listCaptureCategories(db, current);
      if (!active) return;
      if (kind === null) setKindState(current);
      setCategories(list);
      setCategoryId(list[0]?.id ?? null);
      setStatus('ready');
    })().catch(() => active && setStatus('error'));
    return () => {
      active = false;
    };
  }, [db, kind, reloadKey]);

  const setKind = useCallback(
    (next: MovementKind) => {
      if (next === kind) return;
      setKindState(next);
      rememberKind(db, next).catch(() => undefined);
    },
    [db, kind],
  );

  const retry = useCallback(() => {
    setStatus('loading');
    setReloadKey((key) => key + 1);
  }, []);

  const save = useCallback(async () => {
    if (!kind || !categoryId || amountMinor <= 0) return;
    setSaving(true);
    setError(null);
    try {
      await saveCapture(db, {
        kind,
        amountMinor,
        currency: DEFAULT_CURRENCY,
        categoryId,
        note,
        date,
      });
      setAmountMinor(0);
      setNote('');
      setDate(localDateKey());
      setSaved(true);
      // Recarga para que la categoría usada pase al principio.
      setReloadKey((key) => key + 1);
    } catch (cause) {
      setError(cause instanceof AppError ? es.errors[cause.code] : es.recoverableError);
    } finally {
      setSaving(false);
    }
  }, [db, kind, categoryId, amountMinor, note, date]);

  return {
    kind: kind ?? 'expense',
    setKind,
    categories,
    categoryId,
    setCategoryId,
    amountMinor,
    setAmountMinor,
    note,
    setNote,
    date,
    setDate,
    status,
    retry,
    canSave: status === 'ready' && !saving && amountMinor > 0 && categoryId !== null,
    saving,
    save,
    saved,
    dismissSaved: () => setSaved(false),
    error,
  };
}
