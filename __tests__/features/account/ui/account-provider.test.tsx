import { act } from 'react';
import { createRoot } from 'test-renderer';

import { AccountProvider, useAccount, type AccountValue } from '@/features/account';

const mockSynchronize = jest.fn(async () => {});
const mockDb = { getAllAsync: jest.fn(async () => [] as { value: string }[]) };
let mockClient: unknown;

jest.mock('@/db/provider', () => ({ useDatabase: () => mockDb }));
jest.mock('@/db/seed-categories', () => ({ ensureDefaultCategories: jest.fn() }));
jest.mock('@/db/wipe-local-data', () => ({ wipeLocalData: jest.fn() }));
jest.mock('expo-file-system', () => ({ Directory: jest.fn(), Paths: { document: '' } }));
jest.mock('expo-network', () => ({
  getNetworkStateAsync: async () => ({ isConnected: true, isInternetReachable: true }),
  addNetworkStateListener: () => ({ remove: jest.fn() }),
}));
jest.mock('@/sync/supabase-client', () => ({
  getSupabaseClient: () => {
    if (!mockClient) throw new Error('missing env');
    return mockClient;
  },
}));
jest.mock('@/sync/synchronize', () => ({ createSynchronizer: () => mockSynchronize }));
jest.mock('@/sync/supabase-sync', () => ({
  createSupabaseSync: () => ({ userId: async () => 'user-1' }),
}));

function session(email: string) {
  return { user: { email } };
}

function makeClient(current: ReturnType<typeof session> | null) {
  return {
    auth: {
      getSession: async () => ({ data: { session: current }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: jest.fn() } } }),
    },
  };
}

async function mount() {
  const seen: { current?: AccountValue } = {};
  function Probe() {
    seen.current = useAccount();
    return null;
  }
  const root = createRoot();
  await act(async () => {
    root.render(
      <AccountProvider>
        <Probe />
      </AccountProvider>,
    );
  });
  // El primer ciclo se programa con un temporizador de 0 ms.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
  return { seen, root };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDb.getAllAsync.mockResolvedValue([]);
});

it('starts in no-account mode when the environment variables are missing', async () => {
  mockClient = undefined;
  const { seen, root } = await mount();
  expect(seen.current).toMatchObject({ available: false, status: 'signedOut', restoring: false });
  await act(async () => seen.current?.syncNow());
  expect(mockSynchronize).not.toHaveBeenCalled();
  act(() => root.unmount());
});

it('restores the stored session and runs a synchronization cycle', async () => {
  mockClient = makeClient(session('ana@example.com'));
  const { seen, root } = await mount();
  expect(seen.current).toMatchObject({ status: 'signedIn', email: 'ana@example.com' });
  expect(mockSynchronize).toHaveBeenCalledTimes(1);
  expect(seen.current?.sync.state).toBe('synced');
  act(() => root.unmount());
});

it('does not synchronize when the database belongs to another account', async () => {
  mockClient = makeClient(session('b@example.com'));
  mockDb.getAllAsync.mockResolvedValue([{ value: 'user-0' }]);
  const { seen, root } = await mount();
  expect(seen.current?.conflict).toBe(true);
  expect(mockSynchronize).not.toHaveBeenCalled();
  act(() => root.unmount());
});

it('reports a synchronization failure without crashing', async () => {
  mockClient = makeClient(session('ana@example.com'));
  mockSynchronize.mockRejectedValueOnce(new Error('offline'));
  const { seen, root } = await mount();
  expect(seen.current?.sync.state).toBe('error');
  act(() => root.unmount());
});
