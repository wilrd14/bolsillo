import { createAccountService } from '@/features/account/service/account';
import { createSecureSessionStorage } from '@/sync/secure-session';

test('valida credenciales y conserva los datos locales si falla el borrado remoto', async () => {
  const remote = {
    register: jest.fn(async () => {}),
    login: jest.fn(async () => {}),
    logout: jest.fn(async () => {}),
    deleteAccount: jest.fn(async () => {}),
    clearSession: jest.fn(async () => {}),
  };
  const wipe = jest.fn(async () => {});
  const account = createAccountService(remote, wipe);
  await expect(account.login({ email: 'invalid', password: 'synthetic' })).rejects.toMatchObject({
    code: 'VALIDATION',
  });
  expect(remote.login).not.toHaveBeenCalled();
  const input = { email: 'test@example.test', password: 'synthetic' };
  await account.register(input);
  await account.login(input);
  await account.logout();
  expect(remote.register).toHaveBeenCalledWith(input.email, input.password);
  expect(remote.login).toHaveBeenCalledWith(input.email, input.password);
  expect(remote.logout).toHaveBeenCalled();
  remote.deleteAccount.mockRejectedValueOnce(new Error('offline'));
  await expect(account.deleteAccount()).rejects.toThrow('offline');
  expect(wipe).not.toHaveBeenCalled();
  await account.deleteAccount();
  expect(wipe).toHaveBeenCalledTimes(1);
  expect(remote.clearSession).toHaveBeenCalledTimes(1);
});

test('persiste sesiones largas sin superar 2 KB por valor', async () => {
  const values = new Map<string, string>();
  const storage = createSecureSessionStorage({
    getItemAsync: async (key) => values.get(key) ?? null,
    setItemAsync: async (key, value) => {
      expect(Buffer.byteLength(value)).toBeLessThan(2048);
      values.set(key, value);
    },
    deleteItemAsync: async (key) => {
      values.delete(key);
    },
  });
  const session = '😀'.repeat(2000);
  await storage.setItem('session', session);
  expect(await storage.getItem('session')).toBe(session);
  await storage.setItem('session', 'updated');
  expect(await storage.getItem('session')).toBe('updated');
  await storage.removeItem('session');
  expect(await storage.getItem('session')).toBeNull();
  expect(values.size).toBe(0);
});
