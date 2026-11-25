import { act } from 'react';

import { es } from '@/core/strings/es';
import { CaptureScreen } from '@/features/capture';

import { collectText, pressNode, renderWithTheme } from '../../ui/test-utils';

const mockRows: Record<string, unknown[]> = {
  category: [{ id: 'c1', name: 'Comida', color: null }],
};
const mockDb = {
  execAsync: jest.fn(),
  runAsync: jest.fn(),
  getAllAsync: jest.fn(async (sql: string) =>
    sql.includes('FROM category') ? mockRows.category : [],
  ),
};

jest.mock('@/db/provider', () => ({ useDatabase: () => mockDb }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

it('renders the form with Save disabled while the amount is empty', async () => {
  const root = renderWithTheme(<CaptureScreen />);
  await act(async () => {});
  const text = collectText(root.container);
  expect(text).toContain(es.capture.kindExpense);
  expect(text).toContain('Comida');
  const buttons = root.container.queryAll((n) => n.props.accessibilityRole === 'button');
  const save = buttons.find((n) => n.props.accessibilityLabel === es.actions.save);
  expect(save?.props.accessibilityState).toMatchObject({ disabled: true });
  const scan = buttons.find((n) => n.props.accessibilityLabel === es.actions.scanReceipt);
  expect(scan).toBeDefined();
  pressNode(scan!);
  act(() => root.unmount());
});

it('types the amount with the on-screen keypad and enables Save', async () => {
  const root = renderWithTheme(<CaptureScreen />);
  await act(async () => {});
  const key = (label: string) =>
    root.container.queryAll((n) => n.props.accessibilityLabel === label)[0];
  pressNode(key(`${es.capture.keypadKey} 4`));
  pressNode(key(`${es.capture.keypadKey} 5`));
  const save = root.container
    .queryAll((n) => n.props.accessibilityRole === 'button')
    .find((n) => n.props.accessibilityLabel === es.actions.save);
  expect(save?.props.accessibilityState).toMatchObject({ disabled: false });
  pressNode(key(es.capture.keypadDelete));
  pressNode(key(es.capture.keypadDelete));
  expect(
    root.container
      .queryAll((n) => n.props.accessibilityRole === 'button')
      .find((n) => n.props.accessibilityLabel === es.actions.save)?.props.accessibilityState,
  ).toMatchObject({ disabled: true });
  act(() => root.unmount());
});
