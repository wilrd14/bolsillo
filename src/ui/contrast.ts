/** Convierte un color hexadecimal #RRGGBB a componentes RGB [0..255]. */
function parseHexColor(hex: string): [number, number, number] {
  const clean = hex.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) {
    throw new RangeError(`Invalid hex color: ${hex}`);
  }
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function linearizeChannel(channel: number): number {
  const srgb = channel / 255;
  return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
}

/** Calcula la luminancia relativa WCAG 2.1 de un color #RRGGBB. */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHexColor(hex).map(linearizeChannel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Calcula la razón de contraste WCAG 2.1 entre primer plano y fondo. */
export function contrastRatio(foregroundHex: string, backgroundHex: string): number {
  const l1 = relativeLuminance(foregroundHex);
  const l2 = relativeLuminance(backgroundHex);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}
