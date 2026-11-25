import { createDeleteAccountHandler } from './handler.ts';

Deno.test('verifica el JWT y borra primero los objetos del propietario', async () => {
  const calls: string[] = [];
  const handle = createDeleteAccountHandler({
    identify: async (token) => (token === 'synthetic' ? 'owner' : null),
    removeReceipts: async (user) => {
      calls.push(`storage:${user}`);
    },
    removeUser: async (user) => {
      calls.push(`auth:${user}`);
    },
  });
  const url = 'https://example.test/delete-account';
  const unauthorized = await handle(new Request(url, { method: 'POST' }));
  if (unauthorized.status !== 401 || calls.length) throw new Error('Authorization bypass');
  const response = await handle(
    new Request(url, {
      method: 'POST',
      headers: { Authorization: 'Bearer synthetic' },
      body: JSON.stringify({ userId: 'another-user' }),
    }),
  );
  if (response.status !== 204 || calls.join() !== 'storage:owner,auth:owner') {
    throw new Error('Wrong deletion order or scope');
  }
});

Deno.test('conserva el usuario si no se pudo borrar su Storage', async () => {
  let deleted = false;
  const handle = createDeleteAccountHandler({
    identify: async () => 'owner',
    removeReceipts: async () => {
      throw new Error('Unavailable');
    },
    removeUser: async () => {
      deleted = true;
    },
  });
  const response = await handle(
    new Request('https://example.test', {
      method: 'POST',
      headers: { Authorization: 'Bearer synthetic' },
    }),
  );
  if (response.status !== 500 || deleted) throw new Error('Auth deleted before Storage');
});
