import { act } from 'react';

import {
  AmountInput,
  BudgetBar,
  Button,
  CategoryChip,
  MIN_TOUCH_TARGET,
  SummaryCard,
  TransactionRow,
} from '@/ui';

import { collectText, flattenStyle, pressNode, renderWithTheme } from './test-utils';

describe('Componentes UI base: interacción y visualización', () => {
  it('renderiza Button con rol, etiqueta y objetivo táctil >= 44', () => {
    const onPress = jest.fn();
    const root = renderWithTheme(<Button label="Guardar" onPress={onPress} variant="primary" />);
    const button = root.container.queryAll((node) => node.props.accessibilityRole === 'button')[0];

    expect(button).toBeDefined();
    expect(button.props.accessibilityLabel).toBe('Guardar');
    expect(flattenStyle(button.props.style).minHeight).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
    pressNode(button);
    expect(onPress).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
  });

  it('renderiza AmountInput en unidades menores y actualiza al escribir', () => {
    const onChangeMinor = jest.fn();
    const root = renderWithTheme(
      <AmountInput
        kind="expense"
        valueMinor={1250}
        onChangeMinor={onChangeMinor}
        currency="USD"
        locale="en-US"
        label="Monto"
      />,
    );
    const input = root.container.queryAll((node) => node.type === 'TextInput')[0];

    expect(input).toBeDefined();
    expect(input.props.accessibilityLabel).toBe('Monto');
    expect(collectText(root.container)).toContain('-$12.50');
    act(() => {
      input.props.onChangeText('45.99');
    });
    expect(onChangeMinor).toHaveBeenCalledWith(4599);
    act(() => root.unmount());
  });

  it('renderiza CategoryChip seleccionable y de solo lectura con accesibilidad', () => {
    const onPress = jest.fn();
    const root = renderWithTheme(
      <CategoryChip label="Comida" color="#0F766E" selected onPress={onPress} />,
    );
    const chip = root.container.queryAll((node) => node.props.accessibilityRole === 'button')[0];
    expect(chip.props.accessibilityLabel).toBe('Comida');
    expect(chip.props.accessibilityState).toEqual({ selected: true });
    expect(flattenStyle(chip.props.style).minHeight).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
    act(() => root.unmount());

    const readonlyRoot = renderWithTheme(<CategoryChip label="Hogar" color="#15803D" />);
    const readonly = readonlyRoot.container.queryAll(
      (node) => node.props.accessibilityRole === 'text',
    )[0];
    expect(readonly.props.accessibilityLabel).toBe('Hogar');
    act(() => readonlyRoot.unmount());
  });

  it('renderiza TransactionRow con signo, adjunto y accesibilidad', () => {
    const onPress = jest.fn();
    const root = renderWithTheme(
      <TransactionRow
        title="Supermercado"
        subtitle="Compra semanal"
        dateLabel="Hoy"
        amountMinor={2500}
        currency="USD"
        locale="en-US"
        kind="expense"
        categoryColor="#0F766E"
        hasAttachment
        onPress={onPress}
      />,
    );
    const row = root.container.queryAll((node) => node.props.accessibilityRole === 'button')[0];
    const text = collectText(root.container);

    expect(row.props.accessibilityLabel).toContain('Supermercado');
    expect(flattenStyle(row.props.style).minHeight).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
    expect(text).toContain('-$25.00');
    expect(text).toContain('Adjunto');
    act(() => root.unmount());
  });

  it('renderiza BudgetBar con color, texto de estado y barra accesible', () => {
    const root = renderWithTheme(
      <BudgetBar
        title="Comida"
        spentLabel="$80.00"
        limitLabel="$100.00"
        percent={80}
        statusText="80 % usado"
      />,
    );
    const bar = root.container.queryAll(
      (node) => node.props.accessibilityRole === 'progressbar',
    )[0];
    expect(bar.props.accessibilityValue).toEqual({ min: 0, max: 100, now: 80 });
    expect(collectText(root.container)).toContain('80 % usado');
    act(() => root.unmount());
  });

  it('renderiza SummaryCard con rol summary y monto formateado', () => {
    const root = renderWithTheme(
      <SummaryCard
        title="Balance"
        amountMinor={50000}
        currency="USD"
        locale="en-US"
        variant="balance"
        deltaText="+10 % vs mes pasado"
      />,
      'dark',
    );
    const card = root.container.queryAll((node) => node.props.accessibilityRole === 'summary')[0];
    expect(card.props.accessibilityLabel).toContain('Balance');
    expect(collectText(root.container)).toContain('+$500.00');
    act(() => root.unmount());
  });
});
