import { uuid } from 'expo';

import { createUuid } from '@/core/uuid';

/** Usa el generador de Expo en entornos nativos sin Web Crypto. */
export function createLocalId(): string {
  return typeof globalThis.crypto?.getRandomValues === 'function' ? createUuid() : uuid.v4();
}
