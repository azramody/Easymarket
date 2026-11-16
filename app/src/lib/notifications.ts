import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { localTimeFor, NOTIFY_HOUR } from './time';

const KEY = 'easymarket.notify.enabled';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export async function notificationsEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEY)) === '1';
}

export async function requestNotifications(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  let granted = current.granted;
  if (!granted) granted = (await Notifications.requestPermissionsAsync()).granted;
  await AsyncStorage.setItem(KEY, granted ? '1' : '0');
  if (granted) await scheduleDaily();
  return granted;
}

export async function disableNotifications() {
  await AsyncStorage.setItem(KEY, '0');
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * A daily reminder scheduled on the phone itself for 7:00am Eastern.
 * (Server push needs a paid Apple Developer account, so v1 uses a local reminder.
 * The nightly job runs from ~4:15am ET so the episode is normally ready first.)
 * Re-run on every app open so daylight-saving or travel changes are picked up.
 */
export async function scheduleDaily() {
  if (Platform.OS === 'web') return;
  if (!(await notificationsEnabled())) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  const { hour, minute } = localTimeFor(NOTIFY_HOUR);
  await Notifications.scheduleNotificationAsync({
    content: { title: 'Your easymarket episode is ready 🎧', body: "Today's markets, made for you. Tap to listen.", data: { route: '/' } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
  });
}
