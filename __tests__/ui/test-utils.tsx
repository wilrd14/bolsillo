import { act, type ReactElement } from 'react';
import { StyleSheet } from 'react-native';
import { createRoot, type Root, type TestInstance } from 'test-renderer';

import { ThemeProvider, type ThemeMode } from '@/ui';

export function renderWithTheme(element: ReactElement, mode: ThemeMode = 'light'): Root {
  const root = createRoot();
  act(() => {
    root.render(<ThemeProvider mode={mode}>{element}</ThemeProvider>);
  });
  return root;
}

export function collectText(node: TestInstance): string {
  return node.children
    .map((child) => (typeof child === 'string' ? child : collectText(child)))
    .join(' ');
}

export function flattenStyle(style: unknown): Record<string, unknown> {
  const flat = StyleSheet.flatten(style as never);
  return (flat ?? {}) as Record<string, unknown>;
}

export function pressNode(node: TestInstance): void {
  const event = {
    currentTarget: 0,
    target: 0,
    stopPropagation: () => {},
    nativeEvent: {},
  };
  act(() => {
    node.props.onClick?.(event);
  });
}
