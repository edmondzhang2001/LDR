/**
 * Background task for Locket-style widget: on silent push (new photo),
 * fetch latest partner photo, download to App Group, and reload the native widget.
 *
 * Uses two-step download (cache → App Group copy) because downloadAsync can
 * silently fail when writing directly to the App Group shared container.
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

// Capture at load time; can be undefined when task runs headless
const Result = Notifications?.BackgroundNotificationResult ?? {};

let getAppGroupDirectory = () => null;
let reloadWidget = () => {};
try {
  const shared = require('../../modules/shared-storage');
  getAppGroupDirectory = shared.getAppGroupDirectory;
  reloadWidget = shared.reloadWidget;
} catch {
  // iOS-only module
}

/** Download a remote URL into the App Group as current_widget_photo.jpg. */
async function downloadToAppGroup(url) {
  const sharedPath = getAppGroupDirectory(APP_GROUP_ID);
  if (!sharedPath) return false;
  const destUri = 'file://' + sharedPath + '/current_widget_photo.jpg';
  const cacheUri = FileSystem.cacheDirectory + 'widget_photo_tmp.jpg';
  const dl = await FileSystem.downloadAsync(url, cacheUri);
  if (!dl || dl.status !== 200) return false;
  try {
    const existing = await FileSystem.getInfoAsync(destUri, { size: false });
    if (existing.exists) await FileSystem.deleteAsync(destUri, { idempotent: true });
  } catch (_) {}
  await FileSystem.copyAsync({ from: cacheUri, to: destUri });
  return true;
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
    if (activePhotoUrl) {
      await downloadToAppGroup(activePhotoUrl);
    }
    reloadWidget();
  } catch (e) {
    console.warn('[BACKGROUND_WIDGET_UPDATE]', e?.message || e);
    try { reloadWidget(); } catch (_) {}
  }
}

TaskManager.defineTask(TASK_NAME, runWidgetUpdate);

/**
 * Background notification task: when a push arrives (app closed/background),
 * extract photoUrl from payload, download to App Group, reload widget.
 */
async function runBackgroundNotificationTask({ data, error: taskError }) {
  if (taskError) return Result.Failed;
  let photoUrl =
    data?.notification?.data?.photoUrl ||
    (typeof data?.data?.dataString === 'string'
      ? (() => {
          try { return JSON.parse(data.data.dataString)?.photoUrl; } catch { return null; }
        })()
      : null);
  if (!photoUrl || typeof photoUrl !== 'string') {
    return Result.NoData;
  }
  try {
    await downloadToAppGroup(photoUrl);
    reloadWidget();
  } catch (_) {}
  return Result.NewData;
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
