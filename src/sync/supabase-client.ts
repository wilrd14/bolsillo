import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { z } from 'zod';

import { createSecureSessionStorage } from './secure-session';

let client: SupabaseClient | undefined;

/** Comparte la sesión entre cuenta, sincronización y escaneo. */
export function getSupabaseClient(): SupabaseClient {
  return (client ??= createClient(
    z.url().parse(process.env.EXPO_PUBLIC_SUPABASE_URL),
    z.string().min(1).parse(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY),
    {
      auth: {
        storage: createSecureSessionStorage(SecureStore),
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    },
  ));
}
