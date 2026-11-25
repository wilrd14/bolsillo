import { z } from 'zod';

import { createDeleteAccountHandler } from './handler.ts';

const url = Deno.env.get('SUPABASE_URL');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!url || !serviceKey) throw new Error('Missing Supabase configuration');

const adminHeaders = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
};
const bucket = `${url}/storage/v1/object`;
const entries = z.array(z.object({ name: z.string().min(1), id: z.string().nullable() }));

async function removeFolder(prefix: string) {
  for (;;) {
    const response = await fetch(`${bucket}/list/receipts`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ prefix, limit: 100 }),
    });
    if (!response.ok) throw new Error('Storage listing failed');
    const data = entries.parse(await response.json());
    if (!data.length) return;

    const prefixes: string[] = [];
    for (const entry of data) {
      const path = `${prefix}/${entry.name}`;
      if (entry.id === null) await removeFolder(path);
      else prefixes.push(path);
    }
    if (prefixes.length) {
      const removed = await fetch(`${bucket}/receipts`, {
        method: 'DELETE',
        headers: adminHeaders,
        body: JSON.stringify({ prefixes }),
      });
      if (!removed.ok) throw new Error('Storage deletion failed');
    }
  }
}

Deno.serve(
  createDeleteAccountHandler({
    async identify(token) {
      const response = await fetch(`${url}/auth/v1/user`, {
        headers: { ...adminHeaders, Authorization: `Bearer ${token}` },
      });
      if ([401, 403, 404].includes(response.status)) return null;
      if (!response.ok) throw new Error('Session validation failed');
      return z.object({ id: z.uuid() }).parse(await response.json()).id;
    },
    removeReceipts: removeFolder,
    async removeUser(userId) {
      // Las FK de auth.users eliminan los datos de dominio y scan_usage en cascada.
      const response = await fetch(`${url}/auth/v1/admin/users/${userId}`, {
        method: 'DELETE',
        headers: adminHeaders,
        body: JSON.stringify({ should_soft_delete: false }),
      });
      if (!response.ok) throw new Error('Auth deletion failed');
    },
  }),
);
