import { act } from 'react';

import { es } from '@/core/strings/es';
import { ReceiptReviewScreen } from '@/features/receipt-scan/ui/ReceiptReviewScreen';
import { ScanScreen } from '@/features/receipt-scan/ui/ScanScreen';

import { collectText, pressNode, renderWithTheme } from '../../../ui/test-utils';

const mockDb = {};
const mockPush = jest.fn();
const mockBack = jest.fn();
const mockService = {
  enqueueReceipt: jest.fn(),
  getReceipt: jest.fn(),
  listInbox: jest.fn(async () => [] as unknown[]),
  cancelReceipt: jest.fn(async () => undefined),
  confirmReceipt: jest.fn(async () => ({})),
};
let mockAccount = { restoring: false, status: 'signedIn' };
let mockServiceValue: typeof mockService | null = mockService;
const CATEGORY = { id: 'c1', name: 'Comida', kind: 'expense', archived: 0, color: null };

jest.mock('@/db/provider', () => ({ useDatabase: () => mockDb }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args), back: () => mockBack() },
  useFocusEffect: () => undefined,
}));
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
jest.mock('@/features/account', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    useAccount: () => mockAccount,
    RequireAccountNotice: () => <Text>{'REQUIRE_ACCOUNT'}</Text>,
  };
});
jest.mock('@/features/receipt-scan/model/receipt-scan-provider', () => ({
  useReceiptScan: () => mockServiceValue,
}));
jest.mock('@/features/categories', () => ({ listCategories: async () => [CATEGORY] }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const picker = require('expo-image-picker') as Record<string, jest.Mock>;

const extraction = {
  merchant: 'Mercadona',
  date: '2020-01-15',
  total_minor: 4850,
  tax_minor: 441,
  currency: 'DOP',
  items: [{ description: 'Leche', amount_minor: 230 }],
  confidence: { merchant: 0.5, date: 0.9, total: 0.95 },
};
const doneRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'r1',
  status: 'done',
  local_uri: 'file:///r1.jpg',
  error_code: null,
  extracted_json: JSON.stringify(extraction),
  ...overrides,
});

const button = (root: ReturnType<typeof renderWithTheme>, label: string) =>
  root.container
    .queryAll((n) => n.props.accessibilityRole === 'button')
    .find((n) => n.props.accessibilityLabel === label);

async function mountScan() {
  const root = renderWithTheme(<ScanScreen />);
  await act(async () => {});
  return root;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAccount = { restoring: false, status: 'signedIn' };
  mockServiceValue = mockService;
  mockService.listInbox.mockResolvedValue([]);
  picker.launchImageLibraryAsync.mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///x.jpg' }],
  });
});

it('asks for an account when there is no session', async () => {
  mockAccount = { restoring: false, status: 'signedOut' };
  const root = await mountScan();
  expect(collectText(root.container)).toContain('REQUIRE_ACCOUNT');
  expect(button(root, es.scan.takePhoto)).toBeUndefined();
  act(() => root.unmount());
});

it('explains the missing camera permission and still offers the gallery', async () => {
  picker.requestCameraPermissionsAsync.mockResolvedValue({ granted: false });
  const root = await mountScan();
  expect(collectText(root.container)).toContain(es.scan.guide);
  pressNode(button(root, es.scan.takePhoto)!);
  await act(async () => {});
  const text = collectText(root.container);
  expect(text).toContain(es.cameraPermission);
  expect(button(root, es.scan.takePhoto)).toBeUndefined();
  expect(button(root, es.scan.pickPhoto)).toBeDefined();
  expect(picker.launchCameraAsync).not.toHaveBeenCalled();
  act(() => root.unmount());
});

it('opens the review when the receipt is read', async () => {
  mockService.enqueueReceipt.mockResolvedValue(doneRow());
  const root = await mountScan();
  pressNode(button(root, es.scan.pickPhoto)!);
  await act(async () => {});
  expect(mockService.enqueueReceipt).toHaveBeenCalledWith('file:///x.jpg');
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/receipt-review', params: { id: 'r1' } });
  act(() => root.unmount());
});

it.each([
  ['QUOTA_EXCEEDED', es.errors.QUOTA_EXCEEDED],
  ['NOT_A_RECEIPT', es.errors.NOT_A_RECEIPT],
  ['VALIDATION', es.scan.providerError],
])('shows the %s failure and discards the failed receipt', async (code, message) => {
  mockService.enqueueReceipt.mockResolvedValue(doneRow({ status: 'failed', error_code: code }));
  const root = await mountScan();
  pressNode(button(root, es.scan.pickPhoto)!);
  await act(async () => {});
  expect(collectText(root.container)).toContain(message);
  expect(mockService.cancelReceipt).toHaveBeenCalledWith('r1');
  expect(mockPush).not.toHaveBeenCalled();
  act(() => root.unmount());
});

it('keeps an offline scan queued and says so', async () => {
  mockService.enqueueReceipt.mockResolvedValue(
    doneRow({ status: 'pending', extracted_json: null }),
  );
  const root = await mountScan();
  pressNode(button(root, es.scan.pickPhoto)!);
  await act(async () => {});
  expect(collectText(root.container)).toContain(es.scan.queued);
  expect(mockService.cancelReceipt).not.toHaveBeenCalled();
  act(() => root.unmount());
});

it('lists pending scans and discards one after confirming', async () => {
  mockService.listInbox.mockResolvedValue([
    doneRow({
      id: 'p1',
      status: 'pending',
      extracted_json: null,
      created_at: '2026-11-25T10:00:00Z',
    }),
  ]);
  const root = await mountScan();
  await act(async () => {
    await (async () => {})();
  });
  // La lista se carga al enfocar la pantalla; se dispara con un escaneo cancelado.
  picker.launchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null });
  pressNode(button(root, es.scan.pickPhoto)!);
  await act(async () => {});
  expect(collectText(root.container)).toContain(es.pendingScan);
  const discard = root.container
    .queryAll((n) => n.props.accessibilityRole === 'button')
    .find((n) => String(n.props.accessibilityLabel).startsWith(es.scan.discard));
  pressNode(discard!);
  await act(async () => {});
  expect(mockService.cancelReceipt).not.toHaveBeenCalled();
  pressNode(button(root, es.scan.discard)!);
  await act(async () => {});
  expect(mockService.cancelReceipt).toHaveBeenCalledWith('p1');
  act(() => root.unmount());
});

describe('review', () => {
  async function mountReview() {
    const root = renderWithTheme(<ReceiptReviewScreen id="r1" />);
    await act(async () => {});
    return root;
  }

  it('shows the extracted data with low-confidence flags and saves once', async () => {
    mockService.getReceipt.mockResolvedValue(doneRow());
    const root = await mountReview();
    const text = collectText(root.container);
    expect(text).toContain(es.scan.lowConfidence);
    expect(text).toContain('Leche');
    const save = button(root, es.scan.save)!;
    expect(save.props.accessibilityState).toMatchObject({ disabled: false });
    pressNode(save);
    await act(async () => {});
    expect(mockService.confirmReceipt).toHaveBeenCalledTimes(1);
    expect(mockService.confirmReceipt).toHaveBeenCalledWith('r1', {
      amount_minor: 4850,
      currency: 'DOP',
      category_id: 'c1',
      occurred_at: '2020-01-15',
      merchant: 'Mercadona',
    });
    expect(mockBack).toHaveBeenCalled();
    act(() => root.unmount());
  });

  it('blocks saving when the total is not positive', async () => {
    mockService.getReceipt.mockResolvedValue(
      doneRow({ extracted_json: JSON.stringify({ ...extraction, total_minor: 0 }) }),
    );
    const root = await mountReview();
    expect(collectText(root.container)).toContain(es.scan.totalRequired);
    expect(button(root, es.scan.save)!.props.accessibilityState).toMatchObject({ disabled: true });
    act(() => root.unmount());
  });

  it('rejects malformed extraction data', async () => {
    mockService.getReceipt.mockResolvedValue(doneRow({ extracted_json: '{"total_minor":"x"}' }));
    const root = await mountReview();
    expect(collectText(root.container)).toContain(es.scan.invalidData);
    act(() => root.unmount());
  });

  it('asks before discarding and then cancels the receipt', async () => {
    mockService.getReceipt.mockResolvedValue(doneRow());
    const root = await mountReview();
    pressNode(button(root, es.scan.discard)!);
    await act(async () => {});
    expect(mockService.cancelReceipt).not.toHaveBeenCalled();
    const buttons = root.container
      .queryAll((n) => n.props.accessibilityRole === 'button')
      .filter((n) => n.props.accessibilityLabel === es.scan.discard);
    pressNode(buttons[buttons.length - 1]);
    await act(async () => {});
    expect(mockService.cancelReceipt).toHaveBeenCalledWith('r1');
    expect(mockService.confirmReceipt).not.toHaveBeenCalled();
    act(() => root.unmount());
  });
});
