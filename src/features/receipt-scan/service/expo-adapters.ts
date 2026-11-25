import { FunctionsHttpError, type SupabaseClient } from '@supabase/supabase-js';
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { addNetworkStateListener, getNetworkStateAsync } from 'expo-network';
import { Image } from 'react-native';

import type { ReceiptScanDependencies } from './receipt-scan';

export function createExpoReceiptScanDependencies(
  client: Pick<SupabaseClient, 'auth' | 'storage' | 'functions'>,
): ReceiptScanDependencies {
  const online = (state: { isConnected?: boolean; isInternetReachable?: boolean }) =>
    state.isConnected === true && state.isInternetReachable !== false;

  return {
    async compress(uri) {
      const { width, height } = await Image.getSize(uri);
      const context = ImageManipulator.manipulate(uri);
      try {
        if (Math.max(width, height) > 1600) {
          context.resize(width >= height ? { width: 1600 } : { height: 1600 });
        }
        const image = await context.renderAsync();
        try {
          return (await image.saveAsync({ compress: 0.7, format: SaveFormat.JPEG })).uri;
        } finally {
          image.release();
        }
      } finally {
        context.release();
      }
    },
    files: {
      async save(uri, id) {
        const directory = new Directory(Paths.document, 'receipts');
        directory.create({ idempotent: true });
        const destination = new File(directory, `${id}.jpg`);
        new File(uri).move(destination);
        return destination.uri;
      },
      read: (uri) => new File(uri).arrayBuffer(),
      async remove(uri) {
        const file = new File(uri);
        if (file.exists) file.delete();
      },
    },
    network: {
      async isOnline() {
        return online(await getNetworkStateAsync());
      },
      onReconnect(listener) {
        const subscription = addNetworkStateListener((state) => {
          if (online(state)) listener();
        });
        return () => subscription.remove();
      },
    },
    remote: {
      async userId() {
        const { data, error } = await client.auth.getSession();
        if (error) throw error;
        return data.session?.user.id ?? null;
      },
      async upload(path, image) {
        const { error } = await client.storage
          .from('receipts')
          .upload(path, image, { contentType: 'image/jpeg', upsert: true });
        if (error) throw error;
      },
      async scan(id, path) {
        const { data, error } = await client.functions.invoke<unknown>('scan-receipt', {
          body: { receipt_id: id, storage_path: path },
        });
        if (!error) return { ok: true, body: data };
        if (error instanceof FunctionsHttpError) {
          const response: Response = error.context;
          return { ok: false, body: await response.json().catch(() => null) };
        }
        throw error;
      },
      async remove(path) {
        const { error } = await client.storage.from('receipts').remove([path]);
        if (error) throw error;
      },
    },
  };
}
