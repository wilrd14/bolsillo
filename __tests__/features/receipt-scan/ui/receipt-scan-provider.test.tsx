import { act } from 'react';
import { createRoot } from 'test-renderer';

import { ReceiptScanProvider } from '@/features/receipt-scan/model/receipt-scan-provider';

const mockStop = jest.fn();
const mockWatch = jest.fn(() => mockStop);
const mockDb = {};
let mockStatus = 'signedIn';

jest.mock('@/db/provider', () => ({ useDatabase: () => mockDb }));
jest.mock('@/features/account', () => ({ useAccount: () => ({ status: mockStatus }) }));
jest.mock('@/sync/supabase-client', () => ({ getSupabaseClient: () => ({}) }));
jest.mock('@/features/receipt-scan/service/expo-adapters', () => ({
  createExpoReceiptScanDependencies: () => ({}),
}));
jest.mock('@/features/receipt-scan/service/receipt-scan', () => ({
  createReceiptScanService: () => ({ watchQueue: mockWatch }),
}));

async function mount() {
  const root = createRoot();
  await act(async () => {
    root.render(<ReceiptScanProvider>{null}</ReceiptScanProvider>);
  });
  return root;
}

beforeEach(() => jest.clearAllMocks());

it('watches the queue only with a session and stops on unmount', async () => {
  mockStatus = 'signedOut';
  let root = await mount();
  expect(mockWatch).not.toHaveBeenCalled();
  act(() => root.unmount());

  mockStatus = 'signedIn';
  root = await mount();
  expect(mockWatch).toHaveBeenCalledTimes(1);
  act(() => root.unmount());
  expect(mockStop).toHaveBeenCalled();
});
