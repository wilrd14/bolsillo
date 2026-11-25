import { act } from 'react';

import { Banner, ConfirmDialog, EmptyState, MIN_TOUCH_TARGET, Toast } from '@/ui';

import { collectText, flattenStyle, pressNode, renderWithTheme } from './test-utils';

describe('Componentes UI base: estados, avisos y diálogos', () => {
  it('renderiza EmptyState con mensaje y acción accesible', () => {
    const onAction = jest.fn();
    const root = renderWithTheme(
      <EmptyState
        title="Aún no hay movimientos."
        description="Anota tu primer gasto."
        actionLabel="Agregar"
        onAction={onAction}
      />,
    );
    const button = root.container.queryAll((node) => node.props.accessibilityRole === 'button')[0];

    expect(collectText(root.container)).toContain('Aún no hay movimientos.');
    expect(button.props.accessibilityLabel).toBe('Agregar');
    expect(flattenStyle(button.props.style).minHeight).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
    act(() => root.unmount());
  });

  it('renderiza Toast visible y se oculta al cumplirse el temporizador', () => {
    jest.useFakeTimers();
    const onDismiss = jest.fn();
    try {
      const root = renderWithTheme(
        <Toast
          visible
          message="Movimiento guardado"
          variant="success"
          durationMs={2000}
          onDismiss={onDismiss}
        />,
      );
      const alert = root.container.queryAll((node) => node.props.accessibilityRole === 'alert')[0];

      expect(alert.props.accessibilityLabel).toBe('Movimiento guardado');
      act(() => {
        jest.advanceTimersByTime(2000);
      });
      expect(onDismiss).toHaveBeenCalledTimes(1);
      act(() => root.unmount());
    } finally {
      jest.useRealTimers();
    }
  });

  it('renderiza Banner persistente con acción de reintento', () => {
    const onAction = jest.fn();
    const root = renderWithTheme(
      <Banner
        message="Sin conexión."
        variant="offline"
        actionLabel="Reintentar"
        onAction={onAction}
      />,
    );
    const alert = root.container.queryAll((node) => node.props.accessibilityRole === 'alert')[0];
    const action = root.container.queryAll((node) => node.props.accessibilityRole === 'button')[0];

    expect(alert.props.accessibilityLabel).toBe('Sin conexión.');
    expect(flattenStyle(alert.props.style).minHeight).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
    pressNode(action);
    expect(onAction).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
  });

  it('renderiza ConfirmDialog con botones de cancelar y confirmar', () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    const root = renderWithTheme(
      <ConfirmDialog
        visible
        title="Eliminar registro"
        message="Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        variant="destructive"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    const buttons = root.container.queryAll((node) => node.props.accessibilityRole === 'button');
    const dialog = root.container.queryAll((node) => node.props.accessibilityRole === 'alert')[0];

    expect(dialog.props.accessibilityLabel).toBe('Eliminar registro');
    expect(buttons).toHaveLength(2);
    pressNode(buttons[1]);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
  });
});
