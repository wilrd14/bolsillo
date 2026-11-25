import { createBudgetPermissionRequest } from '@/features/budgets/service/budget-alerts';
import { expoBudgetNotifications } from '@/features/budgets/service/expo-budget-notifications';

const requestPermission = createBudgetPermissionRequest(expoBudgetNotifications);

/** La UI llama al callback tras guardar el primer presupuesto. */
export function useNotificationPermission(): () => Promise<boolean> {
  return requestPermission;
}
