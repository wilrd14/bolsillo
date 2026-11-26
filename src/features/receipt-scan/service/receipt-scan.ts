import { z } from 'zod';

import { toIsoUtc } from '@/core/dates';
import { AppError } from '@/core/errors';
import type { Database } from '@/db/database';
import { createLocalId } from '@/db/local-id';
import { withDatabaseAccess } from '@/db/transaction';
import { createTransaction } from '@/features/transactions';
import { createReceiptRepository } from '../data/receipt-repository';
import { receiptExtractionSchema, scanError } from './extraction';

export interface ReceiptScanDependencies {
  compress(uri: string): Promise<string>;
  files: {
    save(uri: string, id: string): Promise<string>;
    read(uri: string): Promise<ArrayBuffer>;
    remove(uri: string): Promise<void>;
  };
  network: {
    isOnline(): Promise<boolean>;
    onReconnect(listener: () => void): () => void;
  };
  remote: {
    userId(): Promise<string | null>;
    upload(path: string, image: ArrayBuffer): Promise<void>;
    scan(id: string, path: string): Promise<{ ok: boolean; body: unknown }>;
    remove(path: string): Promise<void>;
  };
}

const uuid = z.uuid();
const source = z.string().min(1);
const queues = new WeakMap<
  Database,
  {
    running?: Promise<void>;
    rerun: boolean;
    edits: Set<string>;
  }
>();
const confirmation = z.strictObject({
  amount_minor: z.int().positive(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  category_id: uuid,
  occurred_at: z.iso.date(),
  merchant: z.string().nullish(),
  note: z.string().nullish(),
});

function validate<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new AppError('VALIDATION', 'Invalid receipt input');
  return result.data;
}

export function createReceiptScanService(db: Database, deps: ReceiptScanDependencies) {
  const repository = createReceiptRepository(db);
  const now = () => toIsoUtc(new Date());
  const queue = queues.get(db) ?? { rerun: false, edits: new Set<string>() };
  queues.set(db, queue);
  const { edits } = queue;

  async function removeDiscardedFiles() {
    for (const row of await repository.discardedFiles()) {
      await deps.files.remove(row.local_uri);
      await repository.clearDiscardedFile(row.id);
    }
  }

  async function processPending() {
    await withDatabaseAccess(db, removeDiscardedFiles);
    if (!(await deps.network.isOnline())) return;
    const userId = await deps.remote.userId();
    if (userId === null) return;
    validate(uuid, userId);

    const pending = await withDatabaseAccess(db, async () => {
      await repository.recover();
      return repository.pending();
    });
    for (const receipt of pending) {
      if (!(await deps.network.isOnline())) return;
      if (edits.has(receipt.id)) continue;
      const claim = await withDatabaseAccess(db, () => repository.claim(receipt.id, now()));
      if (!claim.changes) continue;

      const path = `${userId}/${receipt.id}.jpg`;
      let failure: AppError | undefined;
      let extracted: string | null = null;
      try {
        const image = await deps.files.read(validate(source, receipt.local_uri));
        await deps.remote.upload(path, image);
        const response = await deps.remote.scan(receipt.id, path);
        if (!response.ok) throw scanError(response.body);
        extracted = JSON.stringify(validate(receiptExtractionSchema, response.body));
      } catch (error) {
        failure = error instanceof AppError ? error : scanError(null);
      }
      const offline = failure && !extracted && !(await deps.network.isOnline().catch(() => true));
      await withDatabaseAccess(db, () =>
        repository.finish(
          receipt.id,
          offline ? 'pending' : failure ? 'failed' : 'done',
          now(),
          path,
          extracted,
          offline ? null : (failure?.code ?? null),
        ),
      );
      if (offline) return;
    }
  }

  function processQueue() {
    queue.rerun = true;
    queue.running ??= (async () => {
      while (queue.rerun) {
        queue.rerun = false;
        await processPending();
      }
    })().finally(() => {
      queue.running = undefined;
    });
    return queue.running;
  }

  async function edit<T>(id: unknown, operation: (receiptId: string) => Promise<T>) {
    const receiptId = validate(uuid, id);
    if (edits.has(receiptId)) throw new AppError('VALIDATION', 'Receipt operation in progress');
    edits.add(receiptId);
    try {
      return await operation(receiptId);
    } finally {
      edits.delete(receiptId);
    }
  }

  return {
    async enqueueReceipt(input: unknown) {
      const uri = validate(source, input);
      const id = createLocalId();
      const compressed = await deps.compress(uri);
      const localUri = await deps.files.save(compressed, id);
      try {
        await withDatabaseAccess(db, () => repository.insert(id, localUri, now()));
      } catch (error) {
        await deps.files.remove(localUri);
        throw error;
      }
      await processQueue();
      return withDatabaseAccess(db, () => repository.find(id));
    },
    getReceipt(id: unknown) {
      return withDatabaseAccess(db, () => repository.find(validate(uuid, id)));
    },
    listPending() {
      return withDatabaseAccess(db, repository.pending);
    },
    listInbox() {
      return withDatabaseAccess(db, repository.listInbox);
    },
    processQueue,
    watchQueue(onError: (error: AppError) => void) {
      const refresh = () => {
        void processQueue().catch(() => onError(scanError(null)));
      };
      const unsubscribe = deps.network.onReconnect(refresh);
      refresh();
      return unsubscribe;
    },
    cancelReceipt(id: unknown) {
      return edit(id, async (receiptId) => {
        await queue.running?.catch(() => undefined);
        await withDatabaseAccess(db, async () => {
          const row = await repository.find(receiptId);
          if (!row) return;
          if (await repository.isAttached(receiptId)) {
            throw new AppError('VALIDATION', 'Receipt is attached to a transaction');
          }
          await repository.remove(receiptId, now());
          await removeDiscardedFiles();
        });
      });
    },
    confirmReceipt(id: unknown, input: unknown) {
      return edit(id, async (receiptId) => {
        const fields = validate(confirmation, input);
        const receipt = await withDatabaseAccess(db, () => repository.find(receiptId));
        if (receipt?.status !== 'done') {
          throw new AppError('VALIDATION', 'Receipt extraction is not complete');
        }
        return createTransaction(db, { ...fields, kind: 'expense', receipt_id: receiptId });
      });
    },
  };
}
