import type { AppErrorCode } from '@/core/errors';

const retryMessage = 'No pudimos completar la acción. Inténtalo de nuevo.';

export const es = {
  loading: 'Cargando…',
  emptyTransactions: 'Aún no hay movimientos. Anota tu primer gasto.',
  emptyBudgets: 'Fija un límite para una categoría y te avisamos.',
  recoverableError: retryMessage,
  scanning: 'Leyendo tu factura…',
  pendingScan: 'Pendiente: se leerá al conectarse',
  cameraPermission:
    'Necesitamos la cámara para fotografiar facturas. También puedes elegir una foto de tu galería.',
  transactionSaved: 'Movimiento guardado',
  actions: {
    retry: 'Reintentar',
    newBudget: 'Nuevo presupuesto',
    save: 'Guardar',
    scanReceipt: 'Escanear factura',
  },
  errors: {
    OFFLINE: 'Sin conexión. Tus datos se guardan en el móvil.',
    QUOTA_EXCEEDED:
      'Llegaste al límite de escaneos de hoy. Mañana puedes seguir o ingresar a mano.',
    NOT_A_RECEIPT: 'No pudimos leer la factura. Prueba con más luz y la hoja plana.',
    VALIDATION: retryMessage,
  } satisfies Record<AppErrorCode, string>,
  budgetWarning(percent: number, category: string): string {
    return `Llevas el ${percent} % de tu presupuesto de ${category} este mes.`;
  },
};
