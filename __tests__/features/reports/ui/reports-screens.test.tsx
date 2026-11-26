import { act, useEffect as mockUseEffect } from 'react';

import { formatMoney } from '@/core/money';
import { es } from '@/core/strings/es';
import { SummaryScreen, HomeScreen } from '@/features/reports';
import { shiftAnchor } from '@/features/reports/model/use-report';

import { collectText, pressNode, renderWithTheme } from '../../../ui/test-utils';

const FOOD = '22222222-2222-4222-8222-222222222222';
const BUS = '33333333-3333-4333-8333-333333333333';

const mockDb = {};
const mockRouter = { push: jest.fn(), navigate: jest.fn() };
let mockReport = {
  expense_minor: 1000,
  income_minor: 5000,
  balance_minor: 4000,
  breakdown: [
    { category_id: FOOD, kind: 'expense', amount_minor: 750 },
    { category_id: BUS, kind: 'expense', amount_minor: 250 },
    { category_id: FOOD, kind: 'income', amount_minor: 5000 },
  ],
};
let mockLatest: unknown[] = [];
let mockFail = false;
const mockGetReport = jest.fn(async (_db: unknown, _input: unknown) => {
  if (mockFail) throw new Error('boom');
  return mockReport;
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 0, right: 0 }),
}));
jest.mock('@/db/provider', () => ({ useDatabase: () => mockDb }));
jest.mock('expo-router', () => ({
  router: {
    push: (...a: unknown[]) => mockRouter.push(...a),
    navigate: (...a: unknown[]) => mockRouter.navigate(...a),
  },
  useFocusEffect: (cb: () => void) => mockUseEffect(cb, [cb]),
}));
jest.mock('@/features/categories', () => ({
  listCategories: async () => [
    { id: FOOD, name: 'Comida', kind: 'expense', color: '#0F766E', archived: 0 },
    { id: BUS, name: 'Transporte', kind: 'expense', color: null, archived: 0 },
  ],
}));
jest.mock('@/features/transactions', () => ({ listTransactions: async () => mockLatest }));
jest.mock('@/features/reports/service/reports', () => ({
  getPeriodReport: (db: unknown, input: unknown) => mockGetReport(db, input),
}));

const MONEY = (n: number) => formatMoney(n, 'DOP', 'es-DO');

beforeEach(() => {
  mockFail = false;
  mockLatest = [
    {
      id: 'tx1',
      kind: 'expense',
      amount_minor: 250,
      currency: 'DOP',
      category_id: BUS,
      merchant: 'Metro',
      note: null,
      occurred_at: '2026-11-25',
    },
  ];
  jest.clearAllMocks();
});

it('home shows service figures, top categories with percent and latest movements', async () => {
  const root = renderWithTheme(<HomeScreen />);
  await act(async () => {});
  const text = collectText(root.container);
  expect(text).toContain(es.home.greeting);
  expect(text).toContain(MONEY(4000));
  expect(text).toContain(MONEY(5000));
  expect(text).toContain(MONEY(750));
  expect(text).toContain('75 %');
  expect(text).toContain('Metro');
  const detail = root.container.queryAll((n) => n.props.accessibilityLabel === es.home.viewDetail);
  pressNode(detail[0]);
  expect(mockRouter.push).toHaveBeenCalledWith('/summary');
  const row = root.container.queryAll((n) =>
    String(n.props.accessibilityLabel ?? '').startsWith('Metro'),
  );
  pressNode(row[0]);
  expect(mockRouter.push).toHaveBeenCalledWith({
    pathname: '/transaction/[id]',
    params: { id: 'tx1' },
  });
  act(() => root.unmount());
});

it('home shows the empty invitation and an error with retry', async () => {
  mockLatest = [];
  let root = renderWithTheme(<HomeScreen />);
  await act(async () => {});
  expect(collectText(root.container)).toContain(es.home.emptyTitle);
  act(() => root.unmount());

  mockFail = true;
  root = renderWithTheme(<HomeScreen />);
  await act(async () => {});
  expect(collectText(root.container)).toContain(es.actions.retry);
  act(() => root.unmount());
});

it('summary rows are labelled with name, amount and percent, and period switches', async () => {
  const root = renderWithTheme(<SummaryScreen />);
  await act(async () => {});
  const labels = root.container
    .queryAll((n) => typeof n.props.accessibilityLabel === 'string')
    .map((n) => n.props.accessibilityLabel as string);
  expect(labels).toContain(es.summary.row('Comida', MONEY(750), 75));
  expect(labels).toContain(es.summary.row('Transporte', MONEY(250), 25));
  const week = root.container.queryAll((n) => n.props.accessibilityLabel === es.summary.week);
  pressNode(week[0]);
  await act(async () => {});
  expect(mockGetReport).toHaveBeenLastCalledWith(
    mockDb,
    expect.objectContaining({ period: 'week' }),
  );
  act(() => root.unmount());
});

it('shifts anchors by week and by month', () => {
  expect(shiftAnchor('2026-11-26', 'week', -1)).toBe('2026-11-19');
  expect(shiftAnchor('2026-01-31', 'month', 1)).toBe('2026-02-01');
  expect(shiftAnchor('2026-01-15', 'month', -1)).toBe('2025-12-01');
});
