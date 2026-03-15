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
/** Extract photoUrl from background task payload (iOS/Android vary; structure differs by platform). */
function getPhotoUrlFromTaskPayload(data) {
  if (!data) return undefined;
  const d = data?.data;
  if (d && typeof d.photoUrl === 'string') return d.photoUrl;
  if (d && typeof d.dataString === 'string') {
    try {
      const parsed = JSON.parse(d.dataString);
      return parsed?.photoUrl ?? parsed?.data?.photoUrl;
    } catch { return undefined; }
  }
  if (data?.notification?.data?.photoUrl) return data.notification.data.photoUrl;
  const body = data?.body ?? data?.payload;
  if (body && (body.photoUrl || body.data?.photoUrl)) return body.photoUrl ?? body.data.photoUrl;
  if (typeof data?.photoUrl === 'string') return data.photoUrl;
  if (typeof data?.data?.photoUrl === 'string') return data.data.photoUrl;
  return undefined;
}

async function runBackgroundNotificationTask({ data, error: taskError }) {
  if (taskError) {
    console.warn('[Duva BG] task error:', String(taskError));
    return Result.Failed;
  }
  const photoUrl = getPhotoUrlFromTaskPayload(data);
  console.warn('[Duva BG] payload keys:', data ? Object.keys(data).join(',') : 'null', '| photoUrl:', photoUrl ? 'ok' : 'MISSING');
  if (photoUrl === undefined) return Result.NoData;
  try {
    const sharedPath = getAppGroupDirectory(APP_GROUP_ID);
    if (!sharedPath) {
      console.warn('[Duva BG] App Group path is null - shared-storage module may have failed to load');
      return Result.NoData;
    }
    const destUri = 'file://' + sharedPath + '/current_widget_photo.jpg';
    const urlStr = typeof photoUrl === 'string' ? photoUrl.trim() : '';
    if (!urlStr) {
      try {
        const info = await FileSystem.getInfoAsync(destUri, { size: false });
        if (info.exists) await FileSystem.deleteAsync(destUri, { idempotent: true });
      } catch (_) {}
    } else {
      const ok = await downloadToAppGroup(urlStr);
      if (!ok) console.warn('[Duva BG] download failed');
    }
    reloadWidget();
  } catch (e) {
    console.warn('[Duva BG] exception:', e?.message || e);
  }
  return Result.NewData;
}

TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, runBackgroundNotificationTask);

/** Extract photoUrl from notification data (used when app is running). */
function getPhotoUrlFromNotification(notification) {
  const d = notification?.request?.content?.data;
  if (!d) return null;
  return d.photoUrl ?? null;
}

/** Update widget using photoUrl from push payload. No API call - works in background. */
async function updateWidgetFromPhotoUrl(photoUrl) {
  try {
    const sharedPath = getAppGroupDirectory(APP_GROUP_ID);
    if (!sharedPath) return;
    const destUri = 'file://' + sharedPath + '/current_widget_photo.jpg';
    if (!photoUrl || typeof photoUrl !== 'string' || photoUrl.trim() === '') {
      try {
        const info = await FileSystem.getInfoAsync(destUri, { size: false });
        if (info.exists) await FileSystem.deleteAsync(destUri, { idempotent: true });
      } catch (_) {}
    } else {
      await downloadToAppGroup(photoUrl);
    }
    reloadWidget();
  } catch (e) {
    console.warn('[updateWidgetFromPhotoUrl]', e?.message || e);
  }
}

/**
 * Register the background widget task and listen for silent push notifications.
 * Call once on app boot (e.g. from _layout.js).
 * When a push arrives with photoUrl, use it directly (no API call) so the widget
 * can update reliably even when the app is backgrounded.
 */
export function registerBackgroundWidgetTask() {
  Notifications.addNotificationReceivedListener((notification) => {
    const dataType = notification?.request?.content?.data?.type;
    const photoUrl = getPhotoUrlFromNotification(notification);
    if (dataType === 'new_photo' || dataType === 'widget_update') {
      if (photoUrl !== null && photoUrl !== undefined) {
        updateWidgetFromPhotoUrl(photoUrl);
      } else {
        TaskManager.runTaskAsync(TASK_NAME, {}).catch(() => {});
      }
    } else {
      const isSilent =
        notification?.request?.content?.data?.contentAvailable === true ||
        (!notification?.request?.content?.title &&
          !notification?.request?.content?.body);
      if (isSilent && photoUrl != null) {
        updateWidgetFromPhotoUrl(photoUrl);
      } else if (isSilent) {
        TaskManager.runTaskAsync(TASK_NAME, {}).catch(() => {});
      }
    }
  });
}

export { TASK_NAME, BACKGROUND_NOTIFICATION_TASK };
