import type { Database, MovementKind } from '@/db/database';
import { createTransaction } from '@/features/transactions';
import { createCaptureRepository } from '@/features/capture/data/capture-repository';

export type { CaptureCategory } from '@/features/capture/data/capture-repository';

export interface CaptureEntry {
  kind: MovementKind;
  amountMinor: number;
  currency: string;
  categoryId: string;
  note: string;
  date: string;
}

export const listCaptureCategories = (db: Database, kind: MovementKind) =>
  createCaptureRepository(db).listRecentCategories(kind);

export async function loadLastKind(db: Database): Promise<MovementKind> {
  return (await createCaptureRepository(db).getLastKind()) ?? 'expense';
}

export async function rememberKind(db: Database, kind: MovementKind): Promise<void> {
  await createCaptureRepository(db).setLastKind(kind);
}

/** Guarda el movimiento; la validación (monto, fecha, categoría) vive en createTransaction. */
export function saveCapture(db: Database, entry: CaptureEntry) {
  return createTransaction(db, {
    kind: entry.kind,
    amount_minor: entry.amountMinor,
    currency: entry.currency,
    category_id: entry.categoryId,
    note: entry.note.trim() === '' ? null : entry.note,
    occurred_at: entry.date,
  });
}
