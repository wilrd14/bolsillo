import type { SupabaseClient } from '@supabase/supabase-js';

import { AppError } from '@/core/errors';

import type { AccountRemote } from './account';

/** Adapta el cliente compartido al contrato de cuenta. */
export function createSupabaseAccount(
  client: Pick<SupabaseClient, 'auth' | 'functions'>,
): AccountRemote {
  async function check(operation: PromiseLike<{ error: unknown }>) {
    const { error } = await operation;
    if (error) throw new AppError('VALIDATION', 'Account operation failed');
  }

  return {
    register: (email, password) => check(client.auth.signUp({ email, password })),
    login: (email, password) => check(client.auth.signInWithPassword({ email, password })),
    logout: () => check(client.auth.signOut()),
    deleteAccount: () => check(client.functions.invoke('delete-account', { method: 'POST' })),
    clearSession: () => check(client.auth.signOut({ scope: 'local' })),
  };
}
