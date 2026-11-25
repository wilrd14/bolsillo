export interface SecureStore {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

/** Publica el índice solo después de persistir todos los fragmentos. */
export function createSecureSessionStorage(store: SecureStore) {
  const readIndex = async (key: string) => {
    const value = await store.getItemAsync(key);
    const match = /^([01])\.(\d+)$/.exec(value ?? '');
    return match ? { prefix: `${key}.${match[1]}`, count: Number(match[2]), slot: match[1] } : null;
  };
  const clear = async (index: Awaited<ReturnType<typeof readIndex>>) => {
    if (!index) return;
    for (let i = 0; i < index.count; i++) await store.deleteItemAsync(`${index.prefix}.${i}`);
  };
  return {
    async getItem(key: string) {
      const index = await readIndex(key);
      if (!index) return store.getItemAsync(key);
      let value = '';
      for (let i = 0; i < index.count; i++) {
        const chunk = await store.getItemAsync(`${index.prefix}.${i}`);
        if (chunk === null) return null;
        value += chunk;
      }
      return value;
    },
    async setItem(key: string, value: string) {
      const previous = await readIndex(key);
      const slot = previous?.slot === '0' ? '1' : '0';
      const chunks = value.match(/[\s\S]{1,500}/gu) ?? [''];
      for (const [i, chunk] of chunks.entries()) {
        await store.setItemAsync(`${key}.${slot}.${i}`, chunk);
      }
      await store.setItemAsync(key, `${slot}.${chunks.length}`);
      await clear(previous);
    },
    async removeItem(key: string) {
      await clear(await readIndex(key));
      await store.deleteItemAsync(key);
    },
  };
}
