import fs from 'node:fs';
import path from 'node:path';

import {
  CAPTURE_BUTTON_SIZE,
  contrastRatio,
  DARK_COLORS,
  getTheme,
  LIGHT_COLORS,
  MIN_TOUCH_TARGET,
  WCAG_NORMAL_TEXT_MIN,
} from '@/ui';

describe('Tema y tokens de Bolsillo', () => {
  const lightPairs: readonly (readonly [string, string, string])[] = [
    ['onPrimary sobre primary', LIGHT_COLORS.onPrimary, LIGHT_COLORS.primary],
    ['text sobre surface', LIGHT_COLORS.text, LIGHT_COLORS.surface],
    ['text sobre background', LIGHT_COLORS.text, LIGHT_COLORS.background],
    ['textMuted sobre surface', LIGHT_COLORS.textMuted, LIGHT_COLORS.surface],
    ['textMuted sobre background', LIGHT_COLORS.textMuted, LIGHT_COLORS.background],
    ['primary sobre surface', LIGHT_COLORS.primary, LIGHT_COLORS.surface],
    ['primary sobre background', LIGHT_COLORS.primary, LIGHT_COLORS.background],
    ['expense sobre surface', LIGHT_COLORS.expense, LIGHT_COLORS.surface],
    ['expense sobre background', LIGHT_COLORS.expense, LIGHT_COLORS.background],
    ['income sobre surface', LIGHT_COLORS.income, LIGHT_COLORS.surface],
    ['income sobre background', LIGHT_COLORS.income, LIGHT_COLORS.background],
    ['warning sobre surface', LIGHT_COLORS.warning, LIGHT_COLORS.surface],
    ['warning sobre background', LIGHT_COLORS.warning, LIGHT_COLORS.background],
    ['danger sobre surface', LIGHT_COLORS.danger, LIGHT_COLORS.surface],
    ['danger sobre background', LIGHT_COLORS.danger, LIGHT_COLORS.background],
    ['onDanger sobre danger', LIGHT_COLORS.onDanger, LIGHT_COLORS.danger],
    ['text sobre surfaceAlt', LIGHT_COLORS.text, LIGHT_COLORS.surfaceAlt],
    ['textMuted sobre surfaceAlt', LIGHT_COLORS.textMuted, LIGHT_COLORS.surfaceAlt],
  ];

  const darkPairs: readonly (readonly [string, string, string])[] = [
    ['onPrimary sobre primary', DARK_COLORS.onPrimary, DARK_COLORS.primary],
    ['text sobre surface', DARK_COLORS.text, DARK_COLORS.surface],
    ['text sobre background', DARK_COLORS.text, DARK_COLORS.background],
    ['textMuted sobre surface', DARK_COLORS.textMuted, DARK_COLORS.surface],
    ['textMuted sobre background', DARK_COLORS.textMuted, DARK_COLORS.background],
    ['primary sobre surface', DARK_COLORS.primary, DARK_COLORS.surface],
    ['primary sobre background', DARK_COLORS.primary, DARK_COLORS.background],
    ['expense sobre surface', DARK_COLORS.expense, DARK_COLORS.surface],
    ['expense sobre background', DARK_COLORS.expense, DARK_COLORS.background],
    ['income sobre surface', DARK_COLORS.income, DARK_COLORS.surface],
    ['income sobre background', DARK_COLORS.income, DARK_COLORS.background],
    ['warning sobre surface', DARK_COLORS.warning, DARK_COLORS.surface],
    ['warning sobre background', DARK_COLORS.warning, DARK_COLORS.background],
    ['danger sobre surface', DARK_COLORS.danger, DARK_COLORS.surface],
    ['danger sobre background', DARK_COLORS.danger, DARK_COLORS.background],
    ['onDanger sobre danger', DARK_COLORS.onDanger, DARK_COLORS.danger],
    ['text sobre surfaceAlt', DARK_COLORS.text, DARK_COLORS.surfaceAlt],
    ['textMuted sobre surfaceAlt', DARK_COLORS.textMuted, DARK_COLORS.surfaceAlt],
  ];

  it.each(lightPairs)('cumple contraste >= 4.5:1 en claro (%s)', (_name, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(WCAG_NORMAL_TEXT_MIN);
  });

  it.each(darkPairs)('cumple contraste >= 4.5:1 en oscuro (%s)', (_name, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(WCAG_NORMAL_TEXT_MIN);
  });

  it('resuelve el tema claro y oscuro y los tamaños táctiles mínimos', () => {
    expect(getTheme('light').mode).toBe('light');
    expect(getTheme('dark').mode).toBe('dark');
    expect(getTheme(null).mode).toBe('light');
    expect(MIN_TOUCH_TARGET).toBeGreaterThanOrEqual(44);
    expect(CAPTURE_BUTTON_SIZE).toBeGreaterThanOrEqual(56);
  });

  it('mantiene src/ui libre de importaciones de features, db, sync o supabase', () => {
    const uiDir = path.resolve(__dirname, '../../src/ui');
    const files = fs.readdirSync(uiDir).filter((file) => /\.(ts|tsx)$/.test(file));
    const forbidden = /from\s+['"](@\/)?(features|db|sync)|@supabase/;
    for (const file of files) {
      const content = fs.readFileSync(path.join(uiDir, file), 'utf8');
      expect(content).not.toMatch(forbidden);
    }
  });
});
