import { router } from 'expo-router';

import { es } from '@/core/strings/es';
import { Banner } from '@/ui';

export interface RequireAccountNoticeProps {
  /** Por defecto abre la pantalla de cuenta. */
  readonly onCreateAccount?: () => void;
}

/** Aviso "Crea una cuenta" para quien intenta escanear sin sesión. */
export function RequireAccountNotice({
  onCreateAccount = () => router.push('/account'),
}: RequireAccountNoticeProps) {
  return (
    <Banner
      variant="info"
      message={`${es.account.requireTitle}. ${es.account.requireMessage}`}
      actionLabel={es.account.requireAction}
      onAction={onCreateAccount}
    />
  );
}
