// Expo push registration. Note the real platform gap (see HANDOFF.md,
// 2026-07-12): as of Expo SDK 53+, Expo Go on Android cannot receive remote
// push notifications at all — only a real dev/standalone build can. iOS
// Expo Go still supports it. This file degrades gracefully either way: a
// registration failure (no projectId configured, permission denied, no
// physical device, Expo Go on Android) logs and returns null — it never
// throws, since push is a background nicety, not something that should ever
// block sign-in or the Jobs screen.

import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

// Foreground behavior: a technician looking at the app when a job lands
// should still see/hear it, same as if the app were backgrounded.
export function configureNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function registerForPushNotificationsAsync() {
  try {
    if (!Device.isDevice) {
      console.warn('[push] skipped — simulators/emulators cannot receive push tokens');
      return null;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }
    if (status !== 'granted') {
      console.warn('[push] permission not granted');
      return null;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      console.warn('[push] no EAS projectId configured — run `eas init` to enable push tokens');
      return null;
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    return token;
  } catch (err) {
    console.warn('[push] registration failed:', err.message);
    return null;
  }
}
