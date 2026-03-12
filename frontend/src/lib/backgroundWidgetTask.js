/**
 * Background task for Locket-style widget: on silent push (new photo),
 * fetch latest partner photo, download to App Group, and reload the native widget.
 */
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';
import { setApiToken, getPartner } from '../lib/api';

const TASK_NAME = 'BACKGROUND_WIDGET_UPDATE';
const TOKEN_KEY = 'ldr_token';
const APP_GROUP_ID = 'group.com.edmond.duva';

let getAppGroupDirectory = () => null;
let reloadWidget = () => {};
try {
  const shared = require('../../modules/shared-storage');
  getAppGroupDirectory = shared.getAppGroupDirectory;
  reloadWidget = shared.reloadWidget;
} catch {
  // iOS-only module
}

async function runWidgetUpdate() {
  try {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (!token) return;
    setApiToken(token);
    const data = await getPartner();
    const partner = data?.partner;
    const photos = partner?.photos ?? [];
    const latestPhoto =
      photos.length > 0
        ? [...photos].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0]
        : null;
    const activePhotoUrl = latestPhoto?.thumbnailUrl || latestPhoto?.url;
    const sharedPath = getAppGroupDirectory(APP_GROUP_ID);
    if (!sharedPath) {
      reloadWidget();
      return;
    }
    const localUri = `file://${sharedPath}/current_widget_photo.jpg`;
    if (activePhotoUrl) {
      await FileSystem.downloadAsync(activePhotoUrl, localUri);
    }
    reloadWidget();
  } catch (e) {
    console.warn('[BACKGROUND_WIDGET_UPDATE]', e?.message || e);
    try {
      reloadWidget();
    } catch (_) {}
  }
}

TaskManager.defineTask(TASK_NAME, runWidgetUpdate);

/**
 * Register the background widget task and listen for silent push notifications.
 * Call once on app boot (e.g. from _layout.js).
 */
export function registerBackgroundWidgetTask() {
  Notifications.addNotificationReceivedListener((notification) => {
    const isSilent =
      notification?.request?.content?.data?.contentAvailable === true ||
      (notification?.request?.content?.data?.contentAvailable !== false &&
        !notification?.request?.content?.title &&
        !notification?.request?.content?.body);
    if (isSilent || notification?.request?.content?.data?.type === 'new_photo') {
      TaskManager.runTaskAsync(TASK_NAME, {}).catch(() => {});
    }
  });
}

export { TASK_NAME };
