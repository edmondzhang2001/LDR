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
const BACKGROUND_NOTIFICATION_TASK = 'BACKGROUND-NOTIFICATION-TASK';
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
 * Background notification task: when a push arrives (app closed/background),
 * extract photoUrl from payload, download to App Group, reload widget.
 * Registered with Notifications.registerTaskAsync so iOS can run it on silent push.
 */
async function runBackgroundNotificationTask({ data, error: taskError }) {
  if (taskError) return Notifications.BackgroundNotificationResult.Failed;
  let photoUrl =
    data?.notification?.data?.photoUrl ||
    (typeof data?.data?.dataString === 'string'
      ? (() => {
          try {
            const parsed = JSON.parse(data.data.dataString);
            return parsed?.photoUrl;
          } catch {
            return null;
          }
        })()
      : null);
  if (!photoUrl || typeof photoUrl !== 'string') {
    return Notifications.BackgroundNotificationResult.NoData;
  }
  const sharedPath = getAppGroupDirectory(APP_GROUP_ID);
  if (!sharedPath) {
    return Notifications.BackgroundNotificationResult.NewData;
  }
  try {
    const localUri = `file://${sharedPath}/current_widget_photo.jpg`;
    await FileSystem.downloadAsync(photoUrl, localUri);
    reloadWidget();
  } catch (e) {
    try {
      reloadWidget();
    } catch (_) {}
  }
  return Notifications.BackgroundNotificationResult.NewData;
}

TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, runBackgroundNotificationTask);

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

export { TASK_NAME, BACKGROUND_NOTIFICATION_TASK };
