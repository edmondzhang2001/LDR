/**
 * Request notification permissions and return the Expo push token for this device.
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

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
      if (finalStatus !== 'granted') {
        return null;
      }
    }

    const tokenData = await Notifications.getExpoPushTokenAsync();
    return tokenData?.data ?? null;
  } catch {
    return null;
  }
}
