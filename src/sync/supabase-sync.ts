import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import { cursorSchema } from './rows';
import type { SyncRemote } from './synchronize';

const PAGE_SIZE = 250;

/** Usa una inserción idempotente y una actualización atómica por versión. */
export function createSupabaseSync(
  client: Pick<SupabaseClient, 'auth' | 'from' | 'rpc' | 'storage'>,
): SyncRemote {
  return {
    async userId() {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      return data.session ? z.uuid().parse(data.session.user.id) : null;
    },
    async push(userId, entity, row) {
      const payload: Record<string, string | number | null | undefined> = {
        ...row,
        user_id: userId,
      };
      if (
        entity === 'budget' ||
        (entity === 'transaction' && 'recurring_id' in row && row.recurring_id !== null)
      ) {
        const { data, error } = await client
          .rpc(entity === 'budget' ? 'merge_sync_budget' : 'merge_sync_transaction', { payload })
          .single();
        if (error) throw error;
        return data;
      }
      const table = client.from(entity);
      const insert = await table.upsert(payload, {
        onConflict: 'user_id,id',
        ignoreDuplicates: true,
      });
      if (insert.error) throw insert.error;
      const query = table.update(payload).eq('user_id', userId).eq('id', row.id);
      const update = await (row.deleted_at
        ? query.lte('updated_at', row.updated_at)
        : query.lt('updated_at', row.updated_at));
      if (update.error) throw update.error;
      if (entity === 'recurring_rule' && 'anchor_day' in row && row.anchor_day != null) {
        const { error } = await table
          .update({ anchor_day: row.anchor_day })
          .eq('user_id', userId)
          .eq('id', row.id)
          .is('anchor_day', null)
          .lte('updated_at', row.updated_at);
        if (error) throw error;
      }
      if (entity === 'receipt' && row.deleted_at) {
        const { data, error } = await table
          .select('deleted_at')
          .eq('user_id', userId)
          .eq('id', row.id)
          .single();
        if (error) throw error;
        if (
          z.object({ deleted_at: z.iso.datetime({ offset: true }).nullable() }).parse(data)
            .deleted_at
        ) {
          const removed = await client.storage.from('receipts').remove([`${userId}/${row.id}.jpg`]);
          if (removed.error) throw removed.error;
        }
      }
    },
    async *pull(userId, entity, after) {
      for (;;) {
        let query = client.from(entity).select('*').eq('user_id', userId);
        if (after) {
          const { synced_at, id } = cursorSchema.parse(after);
          query = query.or(`synced_at.gt.${synced_at},and(synced_at.eq.${synced_at},id.gt.${id})`);
        }
        const { data, error } = await query.order('synced_at').order('id').limit(PAGE_SIZE);
        if (error) throw error;
        for (const row of data) {
          after = cursorSchema.parse(row);
          yield row;
        }
        if (data.length < PAGE_SIZE) return;
      }
    },
  };
}
