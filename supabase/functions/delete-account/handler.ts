export interface AccountDeletion {
  identify(token: string): Promise<string | null>;
  removeReceipts(userId: string): Promise<void>;
  removeUser(userId: string): Promise<void>;
}

export function createDeleteAccountHandler(provider: AccountDeletion) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') {
      return new Response(null, { status: 405, headers: { Allow: 'POST' } });
    }
    const token = /^Bearer ([^\s]+)$/i.exec(request.headers.get('Authorization') ?? '')?.[1];
    if (!token) return new Response(null, { status: 401 });
    try {
      const userId = await provider.identify(token);
      if (!userId) return new Response(null, { status: 401 });
      await provider.removeReceipts(userId);
      await provider.removeUser(userId);
      return new Response(null, { status: 204 });
    } catch {
      return Response.json({ error: { code: 'delete_failed' } }, { status: 500 });
    }
  };
}
