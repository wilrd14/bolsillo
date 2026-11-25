import { z } from 'zod';
import { createHandler } from './handler.ts';
import { anthropicVision } from './vision.ts';

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing server configuration: ${name}`);
  return value;
}

const encoder = new TextEncoder();
const url = requiredEnv('SUPABASE_URL');
const anonKey = requiredEnv('SUPABASE_ANON_KEY');
const serviceKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
const quota = z
  .int()
  .min(0)
  .max(2_147_483_647)
  .parse(Number(Deno.env.get('SCAN_DAILY_QUOTA') ?? 20));

function headers(apiKey: string, token: string) {
  return { apikey: apiKey, Authorization: `Bearer ${token}` };
}

Deno.serve(
  createHandler({
    async authenticate(token) {
      const response = await fetch(`${url}/auth/v1/user`, { headers: headers(anonKey, token) });
      if ([401, 403, 404].includes(response.status)) return null;
      if (!response.ok) throw new Error('Session validation failed');
      return z.object({ id: z.uuid() }).parse(await response.json()).id;
    },
    async consumeQuota(userId) {
      const response = await fetch(`${url}/rest/v1/rpc/increment_scan_usage`, {
        method: 'POST',
        headers: { ...headers(serviceKey, serviceKey), 'content-type': 'application/json' },
        body: JSON.stringify({
          day: new Date().toISOString().slice(0, 10),
          limit: quota,
          p_user_id: userId,
        }),
      });
      if (!response.ok) throw new Error('Quota check failed');
      return z.boolean().parse(await response.json());
    },
    async download(path, token) {
      const response = await fetch(`${url}/storage/v1/object/authenticated/receipts/${path}`, {
        headers: headers(anonKey, token),
      });
      if (response.status === 404) return null;
      if (response.status === 400) {
        const error = z
          .object({ statusCode: z.union([z.literal('404'), z.literal(404)]) })
          .safeParse(await response.json().catch(() => undefined));
        if (error.success) return null;
      }
      if (!response.ok) throw new Error('Image download failed');
      return response.blob();
    },
    vision: anthropicVision,
    log(userId, code, elapsedMs) {
      Deno.stdout.writeSync(
        encoder.encode(JSON.stringify({ user_id: userId, code, elapsed_ms: elapsedMs }) + '\n'),
      );
    },
  }),
);
