import { act } from 'react';

import { es } from '@/core/strings/es';
import { TransactionsScreen } from '@/features/transactions';

import { collectText, pressNode, renderWithTheme } from '../../../ui/test-utils';

const CATEGORY_ID = '11111111-1111-4111-8111-111111111111';

function makeRows(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    kind: 'expense' as const,
    amount_minor: 1000 + index,
    currency: 'DOP',
    category_id: CATEGORY_ID,
    merchant: `Comercio ${index}`,
    note: null,
    // Un día distinto cada 10 movimientos para probar la agrupación.
    occurred_at: `2026-11-${String(28 - (Math.floor(index / 10) % 28)).padStart(2, '0')}`,
  }));
}

let mockAll = makeRows(1000);
const mockList = jest.fn(async (_db: unknown, f: { limit: number; offset: number }) =>
  mockAll.slice(f.offset, f.offset + f.limit),
);
const mockDelete = jest.fn(async () => undefined);

const mockDb = {};
jest.mock('@/db/provider', () => ({ useDatabase: () => mockDb }));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useFocusEffect: () => undefined,
}));
jest.mock('@/features/categories', () => ({
  listCategories: async () => [
    { id: CATEGORY_ID, name: 'Comida', kind: 'expense', color: null, archived: 0 },
  ],
}));
jest.mock('@/features/transactions/service/list-transactions', () => ({
  listTransactions: (db: unknown, f: { limit: number; offset: number }) => mockList(db, f),
}));
jest.mock('@/features/transactions/service/write-transactions', () => ({
  deleteTransaction: () => mockDelete(),
}));

function rowButtons(root: ReturnType<typeof renderWithTheme>) {
  return root.container.queryAll(
    (n) =>
      n.props.accessibilityRole === 'button' &&
      String(n.props.accessibilityLabel ?? '').startsWith('Comercio'),
  );
}

beforeEach(() => {
  mockAll = makeRows(1000);
  mockList.mockClear();
  mockDelete.mockClear();
});

it('virtualizes 1000 movements and groups them by day', async () => {
  const root = renderWithTheme(<TransactionsScreen />);
  await act(async () => {});
  expect(mockList).toHaveBeenCalledTimes(1);
  expect(rowButtons(root).length).toBeGreaterThan(0);
  expect(rowButtons(root).length).toBeLessThan(100);
  expect(collectText(root.container)).toContain('de noviembre de 2026');
  act(() => root.unmount());
});

it('sends combined filters to the service', async () => {
  const root = renderWithTheme(<TransactionsScreen />);
  await act(async () => {});
  const radios = root.container.queryAll((n) => n.props.accessibilityRole === 'radio');
  pressNode(radios.find((n) => n.props.accessibilityLabel === es.capture.kindIncome)!);
  await act(async () => {});
  const buttons = root.container.queryAll((n) => n.props.accessibilityRole === 'button');
  pressNode(buttons.find((n) => n.props.accessibilityLabel === es.transactions.thisMonth)!);
  await act(async () => {});
  const last = mockList.mock.calls.at(-1)![1] as Record<string, unknown>;
  expect(last).toMatchObject({ kind: 'income', offset: 0 });
  expect(String(last.from)).toMatch(/^\d{4}-\d{2}-01$/);
  expect(String(last.to)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  act(() => root.unmount());
});

it('shows the empty state, and the no-results state when filters are active', async () => {
  mockAll = [];
  const root = renderWithTheme(<TransactionsScreen />);
  await act(async () => {});
  expect(collectText(root.container)).toContain(es.emptyTransactions);
  const radios = root.container.queryAll((n) => n.props.accessibilityRole === 'radio');
  pressNode(radios.find((n) => n.props.accessibilityLabel === es.capture.kindIncome)!);
  await act(async () => {});
  expect(collectText(root.container)).toContain(es.transactions.noResults);
  act(() => root.unmount());
});

it('shows a retryable error when loading fails', async () => {
  mockList.mockRejectedValueOnce(new Error('boom'));
  const root = renderWithTheme(<TransactionsScreen />);
  await act(async () => {});
  expect(collectText(root.container)).toContain(es.recoverableError);
  const retry = root.container.queryAll((n) => n.props.accessibilityLabel === es.actions.retry)[0];
  expect(retry).toBeDefined();
  act(() => root.unmount());
});

it('hides a deleted row, allows undo, and commits after the timeout', async () => {
  jest.useFakeTimers();
  try {
    const root = renderWithTheme(<TransactionsScreen />);
    await act(async () => {});
    const del = () =>
      root.container.queryAll(
        (n) =>
          n.props.accessibilityRole === 'button' &&
          String(n.props.accessibilityLabel ?? '').startsWith(es.transactions.deleteItem),
      );
    pressNode(del()[0]);
    expect(collectText(root.container)).toContain(es.transactions.deleted);
    const undo = root.container.queryAll(
      (n) => n.props.accessibilityLabel === es.transactions.undo,
    )[0];
    pressNode(undo);
    expect(mockDelete).not.toHaveBeenCalled();

    pressNode(del()[0]);
    await act(async () => {
      jest.advanceTimersByTime(5100);
    });
    expect(mockDelete).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
  } finally {
    jest.useRealTimers();
  }
});
