import { AppState } from 'react-native';
import { BACKGROUND_NOTIFICATION_TASK } from './backgroundWidgetTask';

/** Wait until app is active so iOS keychain is accessible (avoids "User interaction is not allowed"). */
function whenAppActive() {
  return new Promise((resolve) => {
    if (AppState.currentState === 'active') {
      resolve();
      return;
    }
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        sub.remove();
        resolve();
      }
    });
    // Fallback: resolve after 3s so we don't hang if app never becomes active
    setTimeout(() => {
      sub.remove();
      resolve();
    }, 3000);
  });
}

/**
 * Request notification permissions and return the Expo push token for this device.
 * Also configures the notification handler and registers the background notification
 * task so silent pushes (e.g. new photo) can update the widget when the app is closed/background.
 * Returns null if not on a physical device, permission denied, token fetch fails,
 * or native modules are unavailable (e.g. Expo Go without the module, or simulator).
 * @returns {Promise<string | null>}
 */
export async function registerForPushNotificationsAsync() {
  try {
    let Device;
    let Notifications;
    try {
      Device = require('expo-device');
      Notifications = require('expo-notifications');
    } catch {
      return null;
    }

    if (!Device || !Notifications || !Device.isDevice) {
      return null;
    }

    // Show alerts when app is in foreground
    if (Notifications.setNotificationHandler) {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
      if (finalStatus !== 'granted') {
        return null;
      }
    }

    // Route background/terminated pushes to our task so widget can update from payload photoUrl
    if (Notifications.registerTaskAsync) {
      await Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK);
    }

    // Defer token fetch until app is active so iOS keychain access is allowed (avoids "User interaction is not allowed")
    await whenAppActive();
    const tokenData = await Notifications.getExpoPushTokenAsync();

    console.log('tokenData', tokenData);
    return tokenData?.data ?? null;
  } catch {
    return null;
  }
}
