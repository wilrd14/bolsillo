import type { NotificationPermissionsStatus } from 'expo-notifications';
import { Platform } from 'react-native';

import { es } from '@/core/strings/es';
import type { BudgetNotifications } from './budget-alerts';

const channelId = 'budget-alerts';

function isGranted(
  permission: NotificationPermissionsStatus,
  provisional: NonNullable<NotificationPermissionsStatus['ios']>['status'],
): boolean {
  return permission.granted || permission.ios?.status === provisional;
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS === 'android') {
    const { AndroidImportance, setNotificationChannelAsync } = await import('expo-notifications');
    await setNotificationChannelAsync(channelId, {
      name: es.actions.newBudget,
      importance: AndroidImportance.DEFAULT,
    });
  }
}

export const expoBudgetNotifications: BudgetNotifications = {
  async getPermission() {
    const { getPermissionsAsync, IosAuthorizationStatus } = await import('expo-notifications');
    const permission = await getPermissionsAsync();
    return {
      granted: isGranted(permission, IosAuthorizationStatus.PROVISIONAL),
      canAskAgain: permission.canAskAgain,
    };
  },
  async requestPermission() {
    await ensureAndroidChannel();
    const { requestPermissionsAsync, IosAuthorizationStatus } = await import('expo-notifications');
    return isGranted(await requestPermissionsAsync(), IosAuthorizationStatus.PROVISIONAL);
  },
  async send(body) {
    await ensureAndroidChannel();
    const { scheduleNotificationAsync } = await import('expo-notifications');
    await scheduleNotificationAsync({
      content: { body },
      trigger: Platform.OS === 'android' ? { channelId } : null,
    });
  },
};
