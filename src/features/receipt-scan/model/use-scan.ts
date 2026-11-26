import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useRef, useState } from 'react';

import { AppError } from '@/core/errors';
import { es } from '@/core/strings/es';
import { useAccount } from '@/features/account';

import type { ReceiptRow } from '../data/receipt-repository';
import { useReceiptScan } from './receipt-scan-provider';

export type ScanSource = 'camera' | 'library';
export type InboxStatus = 'loading' | 'ready' | 'error';

const PICKER_OPTIONS = { quality: 1, allowsEditing: false } as const;

/** Mensaje de un escaneo fallido a partir del código guardado. */
export function failureMessage(code: string | null): string {
  if (code === 'QUOTA_EXCEEDED') return es.errors.QUOTA_EXCEEDED;
  if (code === 'NOT_A_RECEIPT') return es.errors.NOT_A_RECEIPT;
  return es.scan.providerError;
}

/** ViewModel de la pantalla de escaneo: permisos, captura, estados y lista de escaneos. */
export function useScan() {
  const service = useReceiptScan();
  const account = useAccount();
  const [processing, setProcessing] = useState(false);
  const [noPermission, setNoPermission] = useState(false);
  const [notice, setNotice] = useState<{ message: string; variant: 'error' | 'offline' } | null>(
    null,
  );
  const [inbox, setInbox] = useState<ReceiptRow[]>([]);
  const [inboxStatus, setInboxStatus] = useState<InboxStatus>('loading');
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    if (!service) return;
    try {
      const rows = await service.listInbox();
      if (!mounted.current) return;
      setInbox(rows);
      setInboxStatus('ready');
    } catch {
      if (mounted.current) setInboxStatus('error');
    }
  }, [service]);

  /** Lanza la cámara o la galería y envía la foto; devuelve el id si ya se puede revisar. */
  const scan = useCallback(
    async (source: ScanSource): Promise<string | null> => {
      if (!service || busy.current) return null;
      busy.current = true;
      setNotice(null);
      setNoPermission(false);
      try {
        if (source === 'camera') {
          const permission = await ImagePicker.requestCameraPermissionsAsync();
          if (!permission.granted) {
            setNoPermission(true);
            return null;
          }
        }
        const picked =
          source === 'camera'
            ? await ImagePicker.launchCameraAsync(PICKER_OPTIONS)
            : await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS);
        const uri = picked.canceled ? undefined : picked.assets[0]?.uri;
        if (!uri) return null;

        setProcessing(true);
        const row = await service.enqueueReceipt(uri);
        if (row?.status === 'done') return row.id;
        if (row?.status === 'failed') {
          setNotice({ message: failureMessage(row.error_code), variant: 'error' });
          // La factura fallida no sirve: se descarta para no dejar foto huérfana.
          await service.cancelReceipt(row.id).catch(() => undefined);
        } else if (row) {
          setNotice({ message: es.scan.queued, variant: 'offline' });
        } else {
          setNotice({ message: es.recoverableError, variant: 'error' });
        }
        return null;
      } catch (cause) {
        const message = cause instanceof AppError ? es.errors[cause.code] : es.recoverableError;
        if (mounted.current) setNotice({ message, variant: 'error' });
        return null;
      } finally {
        busy.current = false;
        if (mounted.current) {
          setProcessing(false);
          void reload();
        }
      }
    },
    [service, reload],
  );

  const discard = useCallback(
    async (id: string) => {
      if (!service) return;
      try {
        await service.cancelReceipt(id);
      } catch {
        if (mounted.current) setNotice({ message: es.recoverableError, variant: 'error' });
      }
      await reload();
    },
    [service, reload],
  );

  return {
    /** 'checking' mientras se restaura la sesión; 'needsAccount' sin sesión o sin Supabase. */
    access: account.restoring
      ? ('checking' as const)
      : account.status === 'signedIn' && service
        ? ('ready' as const)
        : ('needsAccount' as const),
    processing,
    noPermission,
    notice,
    dismissNotice: () => setNotice(null),
    inbox,
    inboxStatus,
    reload,
    scan,
    discard,
  };
}
