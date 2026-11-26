import { act } from 'react';

import { es } from '@/core/strings/es';
import { AccountScreen } from '@/features/account';
import type { AccountValue } from '@/features/account';

import { collectText, pressNode, renderWithTheme } from '../../../ui/test-utils';

const ok = { ok: true, needsConfirmation: false } as const;
const base: AccountValue = {
  available: true,
  restoring: false,
  status: 'signedOut',
  email: null,
  sync: { state: 'idle', lastSyncedAt: null },
  conflict: false,
  signIn: jest.fn(async () => ok),
  signUp: jest.fn(async () => ok),
  signOut: jest.fn(async () => ok),
  deleteAccount: jest.fn(async () => ok),
  syncNow: jest.fn(async () => {}),
  wipeAndContinue: jest.fn(async () => ok),
  retryRestore: jest.fn(),
};
let mockAccount: AccountValue = base;

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/features/account/model/account-provider', () => ({
  useAccount: () => mockAccount,
}));

type Root = ReturnType<typeof renderWithTheme>;
const byLabel = (root: Root, label: string) =>
  root.container.queryAll((n) => n.props.accessibilityLabel === label)[0];
const buttons = (root: Root, label: string) =>
  root.container.queryAll(
    (n) => n.props.accessibilityRole === 'button' && n.props.accessibilityLabel === label,
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockAccount = base;
});

it('explains that the account is unavailable without environment variables', () => {
  mockAccount = { ...base, available: false };
  const root = renderWithTheme(<AccountScreen />);
  expect(collectText(root.container)).toContain(es.account.unavailable);
  act(() => root.unmount());
});

it('shows the loading state while the session is restored', () => {
  mockAccount = { ...base, restoring: true };
  const root = renderWithTheme(<AccountScreen />);
  expect(collectText(root.container)).toContain(es.loading);
  act(() => root.unmount());
});

it('validates the form and signs in with trimmed credentials', async () => {
  const root = renderWithTheme(<AccountScreen />);
  pressNode(buttons(root, es.account.login)[0]);
  const text = collectText(root.container);
  expect(text).toContain(es.account.emailInvalid);
  expect(text).toContain(es.account.passwordRequired);
  expect(base.signIn).not.toHaveBeenCalled();

  const type = (label: string, value: string) =>
    act(() => {
      root.container
        .queryAll((n) => n.props.accessibilityLabel === label && n.props.onChangeText)[0]
        .props.onChangeText(value);
    });
  type(es.account.email, ' ana@example.com ');
  type(es.account.password, 'secreto123');
  await act(async () => {
    pressNode(buttons(root, es.account.login)[0]);
  });
  expect(base.signIn).toHaveBeenCalledWith(' ana@example.com ', 'secreto123');
  act(() => root.unmount());
});

it('requires 8 characters when registering', () => {
  const root = renderWithTheme(<AccountScreen />);
  pressNode(buttons(root, es.account.toRegister)[0]);
  pressNode(buttons(root, es.account.register)[0]);
  expect(collectText(root.container)).toContain(es.account.passwordShort);
  act(() => root.unmount());
});

it('shows sync status and the irreversible delete confirmation when signed in', async () => {
  mockAccount = {
    ...base,
    status: 'signedIn',
    email: 'ana@example.com',
    sync: { state: 'error', lastSyncedAt: null },
  };
  const root = renderWithTheme(<AccountScreen />);
  const text = collectText(root.container);
  expect(text).toContain('ana@example.com');
  expect(text).toContain(es.account.syncError);

  pressNode(buttons(root, es.account.syncNow)[0]);
  expect(base.syncNow).toHaveBeenCalledTimes(1);

  pressNode(buttons(root, es.account.deleteAccount)[0]);
  expect(collectText(root.container)).toContain(es.account.deleteMessage);
  expect(base.deleteAccount).not.toHaveBeenCalled();
  await act(async () => {
    pressNode(buttons(root, es.account.deleteConfirm)[0]);
  });
  expect(base.deleteAccount).toHaveBeenCalledTimes(1);
  act(() => root.unmount());
});

it('offers to wipe local data when the database belongs to another account', async () => {
  mockAccount = { ...base, status: 'signedIn', email: 'b@example.com', conflict: true };
  const root = renderWithTheme(<AccountScreen />);
  expect(collectText(root.container)).toContain(es.account.conflictMessage);
  pressNode(buttons(root, es.account.conflictWipe)[0]);
  await act(async () => {
    pressNode(buttons(root, es.account.wipeConfirm)[0]);
  });
  expect(base.wipeAndContinue).toHaveBeenCalledTimes(1);
  expect(byLabel(root, es.account.syncNow)?.props.accessibilityState).toMatchObject({
    disabled: true,
  });
  act(() => root.unmount());
});
