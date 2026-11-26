import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { toLocalDateKey } from '@/core/dates';
import { AppError } from '@/core/errors';
import { es } from '@/core/strings/es';
import { useDatabase } from '@/db/provider';
import { listCategories } from '@/features/categories';

import { receiptExtractionSchema, type ReceiptExtraction } from '../service/extraction';
import { useReceiptScan } from './receipt-scan-provider';

export type ReviewStatus = 'loading' | 'ready' | 'error' | 'missing' | 'invalid';

/** Por debajo de este valor un campo se marca como dudoso (Brief §12.4). */
export const LOW_CONFIDENCE = 0.7;

export interface ReviewCategory {
  readonly id: string;
  readonly name: string;
  readonly color: string | null;
}

/** ViewModel de la revisión editable de una factura leída. */
export function useReceiptReview(id: string) {
  const db = useDatabase();
  const service = useReceiptScan();
  const [status, setStatus] = useState<ReviewStatus>('loading');
  const [reloadKey, setReloadKey] = useState(0);
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<ReceiptExtraction | null>(null);
  const [categories, setCategories] = useState<ReviewCategory[]>([]);
  const [merchant, setMerchant] = useState('');
  const [date, setDate] = useState('');
  const [totalMinor, setTotalMinor] = useState(0);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const row = service ? await service.getReceipt(id) : undefined;
      if (!active) return;
      if (!row || row.status !== 'done' || !row.extracted_json) {
        setStatus('missing');
        return;
      }
      // El JSON viene de un modelo: se valida otra vez antes de mostrarlo.
      let parsed: ReceiptExtraction;
      try {
        parsed = receiptExtractionSchema.parse(JSON.parse(row.extracted_json));
      } catch {
        setStatus('invalid');
        return;
      }
      const list = (await listCategories(db)).filter((c) => c.kind === 'expense' && !c.archived);
      if (!active) return;
      const today = toLocalDateKey(new Date());
      setLocalUri(row.local_uri);
      setExtraction(parsed);
      setMerchant(parsed.merchant ?? '');
      // Una fecha futura es un error de lectura: se parte de hoy.
      setDate(parsed.date && parsed.date <= today ? parsed.date : today);
      setTotalMinor(parsed.total_minor);
      setCategories(list);
      setCategoryId(list[0]?.id ?? null);
      setStatus('ready');
    })().catch(() => active && setStatus('error'));
    return () => {
      active = false;
    };
  }, [db, service, id, reloadKey]);

  const retry = useCallback(() => {
    setStatus('loading');
    setReloadKey((key) => key + 1);
  }, []);

  const dateValid = date !== '' && date <= toLocalDateKey(new Date());
  const canSave =
    status === 'ready' && !saving && totalMinor > 0 && dateValid && categoryId !== null;

  const save = useCallback(async () => {
    if (!service || !extraction || !categoryId || !canSave || busy.current) return;
    busy.current = true;
    setSaving(true);
    setError(null);
    try {
      await service.confirmReceipt(id, {
        amount_minor: totalMinor,
        currency: extraction.currency,
        category_id: categoryId,
        occurred_at: date,
        merchant: merchant.trim() === '' ? null : merchant,
      });
      setDone(true);
    } catch (cause) {
      setError(cause instanceof AppError ? es.errors[cause.code] : es.recoverableError);
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }, [service, extraction, categoryId, canSave, id, totalMinor, date, merchant]);

  const discard = useCallback(async () => {
    if (!service || busy.current) return;
    busy.current = true;
    setError(null);
    try {
      await service.cancelReceipt(id);
      setDone(true);
    } catch {
      setError(es.recoverableError);
    } finally {
      busy.current = false;
    }
  }, [service, id]);

  // El aviso desaparece cuando la persona corrige el campo.
  const lowConfidence = useMemo(() => {
    if (!extraction) return { merchant: false, date: false, total: false };
    const today = toLocalDateKey(new Date());
    const dateOk = extraction.date !== null && extraction.date <= today;
    return {
      merchant:
        (extraction.confidence.merchant < LOW_CONFIDENCE || !extraction.merchant) &&
        merchant === (extraction.merchant ?? ''),
      date:
        (extraction.confidence.date < LOW_CONFIDENCE || !dateOk) &&
        date === (dateOk ? extraction.date : today),
      total:
        (extraction.confidence.total < LOW_CONFIDENCE || extraction.total_minor <= 0) &&
        totalMinor === extraction.total_minor,
    };
  }, [extraction, merchant, date, totalMinor]);

  return {
    status,
    retry,
    localUri,
    extraction,
    categories,
    merchant,
    setMerchant,
    date,
    setDate,
    totalMinor,
    setTotalMinor,
    categoryId,
    setCategoryId,
    lowConfidence,
    canSave,
    saving,
    save,
    discard,
    /** true tras guardar o descartar: la pantalla debe cerrarse. */
    done,
    error,
  };
}
