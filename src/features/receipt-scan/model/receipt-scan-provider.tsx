import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';

import { useDatabase } from '@/db/provider';
import { useAccount } from '@/features/account';
import { getSupabaseClient } from '@/sync/supabase-client';

import { createExpoReceiptScanDependencies } from '../service/expo-adapters';
import { createReceiptScanService } from '../service/receipt-scan';

export type ReceiptScanService = ReturnType<typeof createReceiptScanService>;

const ReceiptScanContext = createContext<{ service: ReceiptScanService | null } | null>(null);

/** Servicio de escaneo, o null si faltan las variables de entorno de Supabase. */
export function useReceiptScan(): ReceiptScanService | null {
  const value = useContext(ReceiptScanContext);
  if (!value) throw new Error('useReceiptScan requires ReceiptScanProvider');
  return value.service;
}

/** Crea el servicio una sola vez y procesa los escaneos pendientes al tener sesión y red. */
export function ReceiptScanProvider({ children }: { readonly children: ReactNode }) {
  const db = useDatabase();
  const { status } = useAccount();
  const value = useMemo(() => {
    try {
      const deps = createExpoReceiptScanDependencies(getSupabaseClient());
      return { service: createReceiptScanService(db, deps) };
    } catch {
      return { service: null }; // sin EXPO_PUBLIC_SUPABASE_*: modo sin cuenta
    }
  }, [db]);
  const { service } = value;

  useEffect(() => {
    if (!service || status !== 'signedIn') return;
    return service.watchQueue(() => undefined);
  }, [service, status]);

  return <ReceiptScanContext.Provider value={value}>{children}</ReceiptScanContext.Provider>;
}
