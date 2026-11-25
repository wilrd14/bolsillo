import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import { cursorSchema } from './rows';
import type { SyncRemote } from './synchronize';

const PAGE_SIZE = 250;

/** Usa una inserción idempotente y una actualización atómica por versión. */
export function createSupabaseSync(client: Pick<SupabaseClient, 'auth' | 'from'>): SyncRemote {
  return {
    async userId() {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      return data.session ? z.uuid().parse(data.session.user.id) : null;
    },
    async push(userId, entity, row) {
      const table = client.from(entity);
      const payload: Record<string, string | number | null> = { ...row, user_id: userId };
      const insert = await table.upsert(payload, {
        onConflict: 'user_id,id',
        ignoreDuplicates: true,
      });
      if (insert.error) throw insert.error;
      const update = await table
        .update(payload)
        .eq('user_id', userId)
        .eq('id', row.id)
        .lt('updated_at', row.updated_at);
      if (update.error) throw update.error;
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
