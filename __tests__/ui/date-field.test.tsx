import { act } from 'react';
import { Platform } from 'react-native';

import { es } from '@/core/strings/es';
import { DateField } from '@/ui';

import { collectText, pressNode, renderWithTheme } from './test-utils';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockOpen = jest.fn();
jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: () => null,
  DateTimePickerAndroid: { open: (props: unknown) => mockOpen(props) },
}));

function setup() {
  const onChange = jest.fn();
  const root = renderWithTheme(<DateField label="Fecha" value="2026-11-05" onChange={onChange} />);
  const byLabel = (label: string) =>
    root.container.queryAll((n) => n.props.accessibilityLabel === label)[0];
  return { root, onChange, byLabel };
}

describe('DateField', () => {
  afterEach(() => {
    Platform.OS = 'ios';
    mockOpen.mockClear();
  });

  it('muestra la fecha como DD/MM/AAAA', () => {
    const { root } = setup();
    expect(collectText(root.container)).toContain('05/11/2026');
    act(() => root.unmount());
  });

  it('en Android abre el diálogo con máximo hoy y entrega AAAA-MM-DD local', () => {
    Platform.OS = 'android';
    const { root, onChange, byLabel } = setup();
    pressNode(byLabel('Fecha: 05/11/2026'));
    const props = mockOpen.mock.calls[0][0];
    expect(props.maximumDate.getTime()).toBeGreaterThanOrEqual(Date.now());
    props.onValueChange({}, new Date(2026, 9, 31, 0, 5));
    expect(onChange).toHaveBeenCalledWith('2026-10-31');
    act(() => root.unmount());
  });

  it('en iOS abre el modal y Aceptar entrega la fecha', () => {
    const { root, onChange, byLabel } = setup();
    pressNode(byLabel('Fecha: 05/11/2026'));
    pressNode(byLabel(es.actions.accept));
    expect(onChange).toHaveBeenCalledWith('2026-11-05');
    act(() => root.unmount());
  });
});
