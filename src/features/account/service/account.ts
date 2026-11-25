import { z } from 'zod';

import { AppError } from '@/core/errors';

const credentials = z.object({ email: z.email(), password: z.string().min(1) });

export interface AccountRemote {
  register(email: string, password: string): Promise<void>;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  deleteAccount(): Promise<void>;
  clearSession(): Promise<void>;
}

/** Ejecuta las operaciones de cuenta con persistencia y red inyectadas. */
export function createAccountService(remote: AccountRemote, wipeLocalData: () => Promise<void>) {
  function parse(input: unknown) {
    const result = credentials.safeParse(input);
    if (!result.success) throw new AppError('VALIDATION', 'Invalid credentials');
    return result.data;
  }

  return {
    async register(input: unknown) {
      const { email, password } = parse(input);
      await remote.register(email, password);
    },
    async login(input: unknown) {
      const { email, password } = parse(input);
      await remote.login(email, password);
    },
    logout: () => remote.logout(),
    async deleteAccount() {
      await remote.deleteAccount();
      try {
        await wipeLocalData();
      } finally {
        await remote.clearSession();
      }
    },
  };
}
