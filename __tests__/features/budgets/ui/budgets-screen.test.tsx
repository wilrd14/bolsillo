import { act } from 'react';

import { AppError } from '@/core/errors';
import { formatMoney } from '@/core/money';
import { es } from '@/core/strings/es';
import { BudgetsScreen, createBudget, listBudgetProgress, updateBudget } from '@/features/budgets';
import {
  DEFAULT_CURRENCY,
  LOCALE,
  currentMonthKey,
  shiftMonthKey,
} from '@/features/budgets/model/use-budgets';

import { collectText, pressNode, renderWithTheme } from '../../../ui/test-utils';

const CATEGORY_ID = '22222222-2222-4222-8222-222222222222';
const month = currentMonthKey();

const MOCK_CATEGORIES = [
  {
    id: CATEGORY_ID,
    name: 'Comida',
    kind: 'expense',
    icon: null,
    color: '#0F766E',
    is_default: 1,
    archived: 0,
  },
];

let mockBudgets: Awaited<ReturnType<typeof listBudgetProgress>> = [
  {
    id: 'b1',
    category_id: CATEGORY_ID,
    month,
    limit_minor: 400000,
    created_at: '2026-11-01T00:00:00.000Z',
    updated_at: '2026-11-25T00:00:00.000Z',
    deleted_at: null,
    alerted_80: 0,
    alerted_100: 0,
    spent_minor: 320000,
    remaining_minor: 80000,
    percentage: 80,
  },
];

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 0, right: 0 }),
}));
jest.mock('@/db/provider', () => ({ useDatabase: () => ({}) }));
jest.mock('@/features/categories', () => ({ listCategories: async () => MOCK_CATEGORIES }));
jest.mock('@/features/budgets/service/budgets', () => ({
  listBudgetProgress: jest.fn(async () => mockBudgets),
  createBudget: jest.fn(),
  updateBudget: jest.fn(),
  deleteBudget: jest.fn(),
}));

function button(root: ReturnType<typeof renderWithTheme>, label: string) {
  return root.container.queryAll((n) => n.props.accessibilityLabel === label)[0];
}

beforeEach(() => {
  mockBudgets = [
    {
      id: 'b1',
      category_id: CATEGORY_ID,
      month,
      limit_minor: 400000,
      created_at: '2026-11-01T00:00:00.000Z',
      updated_at: '2026-11-25T00:00:00.000Z',
      deleted_at: null,
      alerted_80: 0,
      alerted_100: 0,
      spent_minor: 320000,
      remaining_minor: 80000,
      percentage: 80,
    },
  ];
  jest.clearAllMocks();
});

it('lists budgets with real amounts and a warning status badge', async () => {
  const root = renderWithTheme(<BudgetsScreen />);
  await act(async () => {});
  const text = collectText(root.container);
  expect(listBudgetProgress).toHaveBeenCalledWith({}, month);
  expect(text).toContain(es.budgets.title);
  expect(text).toContain(es.budgets.categories);
  expect(text).toContain(es.budgets.categoriesCount(1));
  expect(text).toContain(formatMoney(400000, DEFAULT_CURRENCY, LOCALE));
  expect(text).toContain(formatMoney(320000, DEFAULT_CURRENCY, LOCALE));
  expect(text).toContain('80 %');
  const bars = root.container.queryAll((n) => n.props.accessibilityRole === 'progressbar');
  expect(bars[0]?.props.accessibilityValue).toMatchObject({ max: 100, now: 80 });
  act(() => root.unmount());
});

it('shows an exceeded status when the budget surpasses 100%', async () => {
  mockBudgets = [
    {
      ...mockBudgets[0],
      limit_minor: 300000,
      spent_minor: 320000,
      remaining_minor: -20000,
      percentage: 107,
    },
  ];
  const root = renderWithTheme(<BudgetsScreen />);
  await act(async () => {});
  const text = collectText(root.container);
  expect(text).toContain('107 %');
  const bars = root.container.queryAll((n) => n.props.accessibilityRole === 'progressbar');
  expect(bars[0]?.props.accessibilityValue).toMatchObject({ max: 100 });
  act(() => root.unmount());
});

it('refetches the budgets when shifting the month', async () => {
  const root = renderWithTheme(<BudgetsScreen />);
  await act(async () => {});
  expect(listBudgetProgress).toHaveBeenLastCalledWith({}, month);
  pressNode(button(root, es.transactions.nextMonth));
  await act(async () => {});
  expect(listBudgetProgress).toHaveBeenLastCalledWith({}, shiftMonthKey(month, 1));
  act(() => root.unmount());
});

it('creates a budget with category and limit from the form', async () => {
  (createBudget as jest.Mock).mockResolvedValue({ id: 'b2', month });
  const root = renderWithTheme(<BudgetsScreen />);
  await act(async () => {});
  pressNode(button(root, es.actions.newBudget));
  expect(collectText(root.container)).toContain(es.budgets.createTitle);
  const input = root.container.queryAll((n) => n.type === 'TextInput')[0];
  await act(async () => {
    input.props.onChangeText('350');
  });
  await act(async () => {
    pressNode(button(root, es.actions.save));
  });
  expect(createBudget).toHaveBeenCalledWith(
    {},
    expect.objectContaining({ category_id: CATEGORY_ID, month, limit_minor: 35000 }),
  );
  act(() => root.unmount());
});

it('shows the validation error on duplicate creation and keeps the list intact', async () => {
  (createBudget as jest.Mock).mockRejectedValue(
    new AppError('VALIDATION', 'Budget already exists for this category and month'),
  );
  const root = renderWithTheme(<BudgetsScreen />);
  await act(async () => {});
  pressNode(button(root, es.actions.newBudget));
  const input = root.container.queryAll((n) => n.type === 'TextInput')[0];
  await act(async () => {
    input.props.onChangeText('350');
  });
  await act(async () => {
    pressNode(button(root, es.actions.save));
  });
  expect(createBudget).toHaveBeenCalledTimes(1);
  expect(collectText(root.container)).toContain(es.errors.VALIDATION);
  act(() => root.unmount());
});

it('edits an existing budget through the form', async () => {
  (updateBudget as jest.Mock).mockResolvedValue({ id: 'b1', month, limit_minor: 500000 });
  const root = renderWithTheme(<BudgetsScreen />);
  await act(async () => {});
  pressNode(button(root, `${es.budgets.editTitle}: Comida`));
  expect(collectText(root.container)).toContain(es.budgets.editTitle);
  const input = root.container.queryAll((n) => n.type === 'TextInput')[0];
  await act(async () => {
    input.props.onChangeText('500');
  });
  await act(async () => {
    pressNode(button(root, es.actions.save));
  });
  expect(updateBudget).toHaveBeenCalledWith(
    {},
    'b1',
    expect.objectContaining({ category_id: CATEGORY_ID, limit_minor: 50000 }),
  );
  act(() => root.unmount());
});
