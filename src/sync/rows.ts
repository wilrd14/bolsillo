import { z } from 'zod';

import type { SyncEntity } from '@/db/outbox-repository';

const timestamp = z.iso
  .datetime({ offset: true })
  .transform((value) => new Date(value).toISOString());
export const cursorSchema = z.object({
  synced_at: z.iso.datetime({ offset: true }),
  id: z.uuid(),
});
export type SyncCursor = z.infer<typeof cursorSchema>;
const base = z.object({
  id: z.uuid(),
  created_at: timestamp,
  updated_at: timestamp,
  deleted_at: timestamp.nullable(),
});
const kind = z.enum(['expense', 'income']);
const flag = z.union([z.literal(0), z.literal(1)]);
const nullableText = z.string().nullable();
const day = z.iso.date();
const category_id = z.uuid();
const amount_minor = z.int().positive();

export const rowSchemas = {
  category: base.extend({
    name: z.string(),
    kind,
    icon: nullableText,
    color: nullableText,
    is_default: flag,
    archived: flag,
  }),
  receipt: base.extend({
    local_uri: nullableText,
    storage_path: nullableText,
    status: z.enum(['pending', 'processing', 'done', 'failed']),
    extracted_json: nullableText,
    error_code: nullableText,
  }),
  recurring_rule: base.extend({
    kind,
    amount_minor,
    category_id,
    frequency: z.enum(['weekly', 'monthly', 'yearly']),
    next_due: day,
    remind_days_before: z.int().nonnegative(),
    active: flag,
  }),
  budget: base.extend({
    category_id,
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    limit_minor: amount_minor,
    alerted_80: flag,
    alerted_100: flag,
  }),
  transaction: base.extend({
    kind,
    amount_minor,
    currency: z.string(),
    category_id,
    merchant: nullableText,
    note: nullableText,
    occurred_at: day,
    receipt_id: z.uuid().nullable(),
    recurring_id: z.uuid().nullable(),
    occurrence_index: z.int().nonnegative().nullable(),
  }),
};

export type SyncRow = z.output<(typeof rowSchemas)[keyof typeof rowSchemas]>;

/** Adelanta únicamente las entradas necesarias para satisfacer claves foráneas. */
export function orderQueue<Item extends { entity: SyncEntity; entity_id: string; payload: string }>(
  queue: Item[],
) {
  const changes = queue.map((item) => ({
    item,
    row: rowSchemas[item.entity].parse(JSON.parse(item.payload)),
  }));
  type Change = (typeof changes)[number];
  const byRow = new Map<string, Change[]>();
  for (const change of changes) {
    const key = `${change.item.entity}/${change.item.entity_id}`;
    const versions = byRow.get(key) ?? [];
    versions.push(change);
    byRow.set(key, versions);
  }
  const ordered = new Set<Change>();
  function add(change: Change) {
    if (ordered.has(change)) return;
    const { row } = change;
    const dependencies = [
      'category_id' in row && `category/${row.category_id}`,
      'receipt_id' in row && row.receipt_id && `receipt/${row.receipt_id}`,
      'recurring_id' in row && row.recurring_id && `recurring_rule/${row.recurring_id}`,
    ];
    for (const dependency of dependencies) {
      if (dependency) for (const parent of byRow.get(dependency) ?? []) add(parent);
    }
    ordered.add(change);
  }
  for (const change of changes) add(change);
  return ordered;
}
