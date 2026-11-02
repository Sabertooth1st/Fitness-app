import * as Notifications from 'expo-notifications';
import type { Weekday } from '../../domain/types';

/**
 * Optional local reminders. Delivery is best-effort; reminders only open the
 * app and can never check in or award XP without a user action.
 */
export async function scheduleReminders(days: Weekday[], hour: number, minute: number, text: { title: string; body: string }): Promise<boolean> {
  const perm = await Notifications.getPermissionsAsync();
  let granted = perm.granted;
  if (!granted && perm.canAskAgain) granted = (await Notifications.requestPermissionsAsync()).granted;
  if (!granted) return false;
  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const d of days) {
    await Notifications.scheduleNotificationAsync({
      content: { title: text.title, body: text.body },
      // Expo weekly triggers use 1 = Sunday; ARRIVE uses ISO 1 = Monday.
      trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: (d % 7) + 1, hour, minute },
    });
  }
  return true;
}

export async function cancelReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
