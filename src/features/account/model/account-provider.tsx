import { Directory, Paths } from 'expo-file-system';
import { addNetworkStateListener, getNetworkStateAsync } from 'expo-network';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import { AppError } from '@/core/errors';
import { es } from '@/core/strings/es';
import { useDatabase } from '@/db/provider';
import { ensureDefaultCategories } from '@/db/seed-categories';
import { wipeLocalData } from '@/db/wipe-local-data';
import { createSupabaseSync } from '@/sync/supabase-sync';
import { getSupabaseClient } from '@/sync/supabase-client';
import { createSynchronizer } from '@/sync/synchronize';

import { createAccountService } from '../service/account';
import { createSupabaseAccount } from '../service/supabase-account';

export type AccountStatus = 'signedOut' | 'signingIn' | 'signedIn' | 'error';
export type SyncState = 'idle' | 'syncing' | 'synced' | 'error';
export type AccountResult =
  | { readonly ok: true; readonly needsConfirmation: boolean }
  | { readonly ok: false; readonly message: string };

export interface AccountValue {
  /** false si faltan las variables de entorno: la app funciona sin cuenta. */
  readonly available: boolean;
  /** true mientras se restaura la sesión guardada al arrancar. */
  readonly restoring: boolean;
  readonly status: AccountStatus;
  readonly email: string | null;
  readonly sync: { readonly state: SyncState; readonly lastSyncedAt: number | null };
  /** La base local pertenece a otra cuenta: no se sincroniza hasta decidir. */
  readonly conflict: boolean;
  signIn(email: string, password: string): Promise<AccountResult>;
  signUp(email: string, password: string): Promise<AccountResult>;
  signOut(): Promise<AccountResult>;
  deleteAccount(): Promise<AccountResult>;
  syncNow(): Promise<void>;
  wipeAndContinue(): Promise<AccountResult>;
  retryRestore(): void;
}

const AccountContext = createContext<AccountValue | null>(null);

export function useAccount(): AccountValue {
  const value = useContext(AccountContext);
  if (!value) throw new Error('useAccount requires AccountProvider');
  return value;
}

// Clave que fija `createOutboxRepository` (src/db/outbox-repository.ts).
const OWNER_KEY = 'sync.owner';
const IDLE_SYNC = { state: 'idle', lastSyncedAt: null } as const;
const fail = { ok: false, message: es.recoverableError } as const;

async function isOnline(): Promise<boolean> {
  const state = await getNetworkStateAsync();
  return state.isConnected === true && state.isInternetReachable !== false;
}

function createClientOrNull() {
  try {
    return getSupabaseClient();
  } catch {
    return null; // sin EXPO_PUBLIC_SUPABASE_*: modo sin cuenta
  }
}

/** Crea el cliente compartido, restaura la sesión y mantiene la sincronización en marcha. */
export function AccountProvider({ children }: { readonly children: ReactNode }) {
  const db = useDatabase();
  const client = useMemo(() => createClientOrNull(), []);
  const parts = useMemo(
    () =>
      client
        ? {
            remote: createSupabaseSync(client),
            wipeAll: async () => {
              await wipeLocalData(db);
              try {
                const photos = new Directory(Paths.document, 'receipts');
                if (photos.exists) photos.delete();
              } catch {
                // las fotos huérfanas no deben impedir el borrado de la base
              }
              await ensureDefaultCategories(db);
            },
          }
        : null,
    [client, db],
  );
  const accounts = useMemo(
    () =>
      client && parts ? createAccountService(createSupabaseAccount(client), parts.wipeAll) : null,
    [client, parts],
  );
  const synchronize = useMemo(
    () =>
      parts ? createSynchronizer(db, { remote: parts.remote, isOnline, now: Date.now }) : null,
    [db, parts],
  );

  const [restoring, setRestoring] = useState(client !== null);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<AccountStatus>(client ? 'signingIn' : 'signedOut');
  const [email, setEmail] = useState<string | null>(null);
  const [sync, setSync] = useState<AccountValue['sync']>(IDLE_SYNC);
  const [conflict, setConflict] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const applySession = useCallback((session: { user: { email?: string } } | null) => {
    setEmail(session?.user.email ?? null);
    setStatus(session ? 'signedIn' : 'signedOut');
    if (!session) {
      setSync(IDLE_SYNC);
      setConflict(false);
    }
  }, []);

  useEffect(() => {
    if (!client) return;
    let active = true;
    client.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setStatus('error');
        else applySession(data.session);
      })
      .catch(() => active && setStatus('error'))
      .finally(() => active && setRestoring(false));
    // La devolución de llamada no espera operaciones de Supabase (evita bloqueos del cliente).
    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (event !== 'INITIAL_SESSION') applySession(session);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [client, attempt, applySession]);

  const syncNow = useCallback(async () => {
    if (!parts || !synchronize) return;
    try {
      const userId = await parts.remote.userId();
      if (!userId) return;
      const rows = await db.getAllAsync<{ value: string }>(
        'SELECT value FROM app_settings WHERE key = ?',
        OWNER_KEY,
      );
      const foreign = rows[0] !== undefined && rows[0].value !== userId;
      if (!mounted.current) return;
      setConflict(foreign);
      if (foreign) return;
      setSync((previous) => ({ ...previous, state: 'syncing' }));
      await synchronize();
      if (mounted.current) setSync({ state: 'synced', lastSyncedAt: Date.now() });
    } catch {
      if (mounted.current) setSync((previous) => ({ ...previous, state: 'error' }));
    }
  }, [db, parts, synchronize]);

  // Ciclo al iniciar sesión, al volver a primer plano y al recuperar la red.
  useEffect(() => {
    if (status !== 'signedIn') return;
    const first = setTimeout(() => void syncNow(), 0); // fuera del cuerpo del efecto
    const appState = AppState.addEventListener('change', (next) => {
      if (next === 'active') void syncNow();
    });
    const network = addNetworkStateListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) void syncNow();
    });
    return () => {
      clearTimeout(first);
      appState.remove();
      network.remove();
    };
  }, [status, syncNow]);

  const authenticate = useCallback(
    async (mode: 'login' | 'register', mail: string, password: string): Promise<AccountResult> => {
      if (!accounts || !client) return { ok: false, message: es.account.unavailable };
      try {
        if (!(await isOnline())) throw new AppError('OFFLINE', 'No connection');
        const input = { email: mail.trim(), password };
        await (mode === 'login' ? accounts.login(input) : accounts.register(input));
        const { data } = await client.auth.getSession();
        applySession(data.session);
        return { ok: true, needsConfirmation: data.session === null };
      } catch (error) {
        const offline = error instanceof AppError && error.code === 'OFFLINE';
        return {
          ok: false,
          message: offline
            ? es.errors.OFFLINE
            : mode === 'login'
              ? es.account.loginFailed
              : es.account.registerFailed,
        };
      }
    },
    [accounts, client, applySession],
  );

  const value = useMemo<AccountValue>(
    () => ({
      available: client !== null,
      restoring,
      status,
      email,
      sync,
      conflict,
      signIn: (mail, password) => authenticate('login', mail, password),
      signUp: (mail, password) => authenticate('register', mail, password),
      async signOut() {
        if (!accounts || !client) return fail;
        try {
          await accounts.logout();
        } catch {
          // Sin red el cierre global falla: se cierra al menos la sesión del móvil.
          const { error } = await client.auth.signOut({ scope: 'local' });
          if (error) return fail;
        }
        applySession(null);
        return { ok: true, needsConfirmation: false };
      },
      async deleteAccount() {
        if (!accounts) return fail;
        try {
          await accounts.deleteAccount();
        } catch {
          const offline = !(await isOnline().catch(() => false));
          return { ok: false, message: offline ? es.errors.OFFLINE : es.recoverableError };
        }
        applySession(null);
        return { ok: true, needsConfirmation: false };
      },
      syncNow,
      async wipeAndContinue() {
        if (!parts) return fail;
        try {
          await parts.wipeAll();
        } catch {
          return fail;
        }
        setConflict(false);
        void syncNow();
        return { ok: true, needsConfirmation: false };
      },
      retryRestore: () => {
        setRestoring(true);
        setStatus('signingIn');
        setAttempt((n) => n + 1);
      },
    }),
    [
      client,
      restoring,
      status,
      email,
      sync,
      conflict,
      authenticate,
      accounts,
      parts,
      syncNow,
      applySession,
    ],
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}
