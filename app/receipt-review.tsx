import { useLocalSearchParams } from 'expo-router';

import { ReceiptReviewScreen } from '@/features/receipt-scan';

/** Ruta de la revisión de una factura leída. */
export default function ReceiptReviewRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ReceiptReviewScreen id={id} />;
}
