import { z } from 'zod';

import { es } from '@/core/strings/es';

export type AuthMode = 'login' | 'register';
export interface CredentialErrors {
  email?: string;
  password?: string;
}

const email = z.email();

/** Valida el formulario en el móvil; el servicio vuelve a validar antes de llamar a la red. */
export function validateCredentials(
  mode: AuthMode,
  values: { email: string; password: string },
): CredentialErrors {
  const errors: CredentialErrors = {};
  if (!email.safeParse(values.email.trim()).success) errors.email = es.account.emailInvalid;
  if (mode === 'register' && values.password.length < 8) errors.password = es.account.passwordShort;
  if (mode === 'login' && values.password.length === 0)
    errors.password = es.account.passwordRequired;
  return errors;
}
