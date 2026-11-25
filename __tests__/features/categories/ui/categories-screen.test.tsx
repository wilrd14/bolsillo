import { act } from 'react';

import { es } from '@/core/strings/es';
import { CategoriesScreen } from '@/features/categories';

import { collectText, pressNode, renderWithTheme } from '../../../ui/test-utils';

const ID = '11111111-1111-4111-8111-111111111111';
let mockRows = [
  { id: ID, name: 'Comida', kind: 'expense', icon: 'restaurant', color: '#0F766E', archived: 0 },
  { id: 'i', name: 'Salario', kind: 'income', icon: 'cash', color: '#15803D', archived: 0 },
];
const mockArchive = jest.fn(async () => {
  mockRows = mockRows.map((r) => (r.id === ID ? { ...r, archived: 1 } : r));
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 0, right: 0 }),
}));
jest.mock('@/db/provider', () => ({ useDatabase: () => ({}) }));
jest.mock('@/features/categories/data/category-repository', () => ({
  createCategoryRepository: () => ({ list: async () => mockRows }),
}));
jest.mock('@/features/categories/service/write-categories', () => ({
  archiveCategory: () => mockArchive(),
  createCategory: jest.fn(),
  updateCategory: jest.fn(),
}));

function button(root: ReturnType<typeof renderWithTheme>, label: string) {
  return root.container.queryAll((n) => n.props.accessibilityLabel === label)[0];
}

it('lists categories by kind and archives after confirmation', async () => {
  const root = renderWithTheme(<CategoriesScreen />);
  await act(async () => {});
  const text = collectText(root.container);
  expect(text).toContain('Comida');
  expect(text).not.toContain('Salario');

  pressNode(button(root, `${es.categories.archive}: Comida`));
  expect(collectText(root.container)).toContain(es.categories.archiveMessage);
  const confirm = root.container.queryAll(
    (n) => n.props.accessibilityRole === 'button' && collectText(n) === es.categories.archive,
  );
  await act(async () => {
    pressNode(confirm[confirm.length - 1]);
  });
  expect(mockArchive).toHaveBeenCalledTimes(1);
  expect(collectText(root.container)).not.toContain('Comida');
  act(() => root.unmount());
});
