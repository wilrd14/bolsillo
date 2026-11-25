import { useLocalSearchParams } from 'expo-router';

import { TransactionDetailScreen } from '@/features/transactions';

/** Ruta del detalle de un movimiento. */
export default function TransactionDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TransactionDetailScreen id={id} />;
}
