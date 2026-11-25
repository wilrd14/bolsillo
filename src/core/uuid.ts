/** Genera un UUID v4 a partir de Web Crypto o de una fuente segura del entorno. */
export function createUuid(
  fillRandom: (bytes: Uint8Array<ArrayBuffer>) => void = (bytes) =>
    globalThis.crypto.getRandomValues(bytes),
): string {
  const bytes = new Uint8Array(16);
  fillRandom(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}
