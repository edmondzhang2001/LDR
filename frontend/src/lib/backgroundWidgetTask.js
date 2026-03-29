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
let nativeUpdateWidgetPhotoFromUrl = async () => false;

// Module-level subscription handle so we never register more than one listener.
let _notificationSubscription = null;
try {
  const shared = require('../../modules/shared-storage');
  getAppGroupDirectory = shared.getAppGroupDirectory;
  reloadWidget = shared.reloadWidget;
  nativeUpdateWidgetPhotoFromUrl = shared.updateWidgetPhotoFromUrl;
} catch {
  // iOS-only module
}

/** Download a remote URL into the App Group as current_widget_photo.jpg. */
async function writeCaptionToAppGroup(caption) {
  const sharedPath = getAppGroupDirectory(APP_GROUP_ID);
  if (!sharedPath) return;
  const captionUri = 'file://' + sharedPath + '/current_widget_photo_caption.txt';
  const normalizedCaption = typeof caption === 'string' ? caption.trim().slice(0, 120) : '';
  if (normalizedCaption) {
    await FileSystem.writeAsStringAsync(captionUri, normalizedCaption);
    return;
  }
  try {
    const info = await FileSystem.getInfoAsync(captionUri, { size: false });
    if (info.exists) await FileSystem.deleteAsync(captionUri, { idempotent: true });
  } catch (_) {}
}

async function writeActiveImagePointer(sharedPath, fileName) {
  if (!sharedPath || !fileName) return;
  const pointerUri = 'file://' + sharedPath + '/current_widget_photo_active.txt';
  try {
    await FileSystem.writeAsStringAsync(pointerUri, String(fileName).trim());
  } catch (_) {}
}

async function clearWidgetImageFiles(sharedPath) {
  if (!sharedPath) return;
  const fallbackUri = 'file://' + sharedPath + '/current_widget_photo.jpg';
  const pointerUri = 'file://' + sharedPath + '/current_widget_photo_active.txt';
  try {
    const pointerInfo = await FileSystem.getInfoAsync(pointerUri, { size: false });
    if (pointerInfo.exists) {
      const activeName = (await FileSystem.readAsStringAsync(pointerUri)).trim();
      if (activeName) {
        const activeUri = 'file://' + sharedPath + '/' + activeName;
        await FileSystem.deleteAsync(activeUri, { idempotent: true }).catch(() => {});
      }
      await FileSystem.deleteAsync(pointerUri, { idempotent: true }).catch(() => {});
    }
  } catch (_) {}
  await FileSystem.deleteAsync(fallbackUri, { idempotent: true }).catch(() => {});
}

/** Download a remote URL into the App Group as current_widget_photo.jpg. */
async function downloadToAppGroup(url, caption = '') {
  try {
    const nativeOk = await nativeUpdateWidgetPhotoFromUrl(url, caption, APP_GROUP_ID);
    if (nativeOk) {
      console.warn('[Duva BG] native download ok');
      return true;
    }
    console.warn('[Duva BG] native download unavailable/failed; using JS fallback');
    const sharedPath = getAppGroupDirectory(APP_GROUP_ID);
    if (!sharedPath) return false;
    const fileName = `current_widget_photo_${Date.now()}.jpg`;
    const destUri = 'file://' + sharedPath + '/' + fileName;
    const fallbackUri = 'file://' + sharedPath + '/current_widget_photo.jpg';
    const cacheBase = FileSystem.cacheDirectory || 'file://' + sharedPath + '/';
    const cacheUri = cacheBase + 'widget_photo_tmp.jpg';
    console.warn('[Duva BG] download start');
    const dl = await FileSystem.downloadAsync(url, cacheUri);
    console.warn('[Duva BG] download done status:', dl?.status ?? 'no-response');
    if (!dl || dl.status !== 200) {
      console.warn('[Duva BG] download status != 200:', dl?.status ?? 'no-response');
      return false;
    }
    try {
      await clearWidgetImageFiles(sharedPath);
      const existing = await FileSystem.getInfoAsync(destUri, { size: false });
      if (existing.exists) await FileSystem.deleteAsync(destUri, { idempotent: true });
    } catch (_) {}
    await FileSystem.copyAsync({ from: cacheUri, to: destUri });
    await FileSystem.copyAsync({ from: cacheUri, to: fallbackUri }).catch(() => {});
    await writeActiveImagePointer(sharedPath, fileName);
    try {
      const written = await FileSystem.getInfoAsync(destUri, { size: true });
      if (!written.exists || !written.size) {
        console.warn('[Duva BG] copied file missing/empty after write');
        return false;
      }
    } catch (_) {
      console.warn('[Duva BG] could not verify copied file');
      return false;
    }
    await writeCaptionToAppGroup(caption);
    return true;
  } catch (e) {
    console.warn('[Duva BG] downloadToAppGroup exception:', e?.message || e);
    return false;
  }
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeoutPromise = new Promise((resolve) => {
    timer = setTimeout(() => {
      console.warn('[Duva BG] timeout:', label);
      resolve(false);
    }, ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
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
      await downloadToAppGroup(activePhotoUrl, latestPhoto?.caption ?? '');
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
  // Primary Expo path: data.notification.request.content.data (background notification task)
  const notifData = data?.notification?.request?.content?.data;
  if (notifData && typeof notifData.photoUrl === 'string') return notifData.photoUrl;
  // Expo sometimes double-nests: data.notification.request.content.data.data
  const notifInner = notifData?.data;
  if (notifInner && typeof notifInner.photoUrl === 'string') return notifInner.photoUrl;
  // Legacy / alternate paths
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

function getCaptionFromTaskPayload(data) {
  if (!data) return '';
  // Primary Expo path: data.notification.request.content.data (background notification task)
  const notifData = data?.notification?.request?.content?.data;
  if (notifData && typeof notifData.caption === 'string') return notifData.caption;
  const notifInner = notifData?.data;
  if (notifInner && typeof notifInner.caption === 'string') return notifInner.caption;
  // Legacy / alternate paths
  const d = data?.data;
  if (d && typeof d.caption === 'string') return d.caption;
  if (d && typeof d.dataString === 'string') {
    try {
      const parsed = JSON.parse(d.dataString);
      return parsed?.caption ?? parsed?.data?.caption ?? '';
    } catch { return ''; }
  }
  if (typeof data?.notification?.data?.caption === 'string') return data.notification.data.caption;
  const body = data?.body ?? data?.payload;
  if (typeof body?.caption === 'string') return body.caption;
  if (typeof body?.data?.caption === 'string') return body.data.caption;
  if (typeof data?.caption === 'string') return data.caption;
  if (typeof data?.data?.caption === 'string') return data.data.caption;
  return '';
}

async function runBackgroundNotificationTask({ data, error: taskError }) {
  if (taskError) {
    console.warn('[Duva BG] task error:', String(taskError));
    return Result.Failed;
  }
  const photoUrl = getPhotoUrlFromTaskPayload(data);
  const caption = getCaptionFromTaskPayload(data);
  const notifDataKeys = data?.notification?.request?.content?.data ? Object.keys(data.notification.request.content.data).join(',') : 'none';
  console.warn('[Duva BG] payload keys:', data ? Object.keys(data).join(',') : 'null', '| notif.data keys:', notifDataKeys, '| photoUrl:', photoUrl ? 'ok' : 'MISSING');
  if (photoUrl === undefined) return Result.NoData;
  try {
    const sharedPath = getAppGroupDirectory(APP_GROUP_ID);
    if (!sharedPath) {
      console.warn('[Duva BG] App Group path is null - shared-storage module may have failed to load');
      return Result.NoData;
    }
    console.warn('[Duva BG] App Group path:', sharedPath);
    const urlStr = typeof photoUrl === 'string' ? photoUrl.trim() : '';
    let updateOk = true;
    if (!urlStr) {
      await clearWidgetImageFiles(sharedPath);
      await writeCaptionToAppGroup('');
    } else {
      console.warn('[Duva BG] processing photoUrl');
      const ok = await withTimeout(downloadToAppGroup(urlStr, caption), 12000, 'downloadToAppGroup');
      if (!ok) {
        console.warn('[Duva BG] direct download failed, falling back to API sync');
        try {
          await withTimeout(runWidgetUpdate(), 10000, 'runWidgetUpdate');
        } catch (_) {}
        const pointerUri = 'file://' + sharedPath + '/current_widget_photo_active.txt';
        const fallbackUri = 'file://' + sharedPath + '/current_widget_photo.jpg';
        const activeName = await FileSystem.readAsStringAsync(pointerUri).then((s) => s.trim()).catch(() => '');
        const checkUri = activeName ? 'file://' + sharedPath + '/' + activeName : fallbackUri;
        const infoAfterFallback = await FileSystem.getInfoAsync(checkUri, { size: true }).catch(() => ({ exists: false, size: 0 }));
        updateOk = !!infoAfterFallback?.exists && !!infoAfterFallback?.size;
      } else {
        const pointerUri = 'file://' + sharedPath + '/current_widget_photo_active.txt';
        const fallbackUri = 'file://' + sharedPath + '/current_widget_photo.jpg';
        const activeName = await FileSystem.readAsStringAsync(pointerUri).then((s) => s.trim()).catch(() => '');
        const checkUri = activeName ? 'file://' + sharedPath + '/' + activeName : fallbackUri;
        const info = await FileSystem.getInfoAsync(checkUri, { size: true }).catch(() => null);
        console.warn('[Duva BG] wrote widget image bytes:', info?.size ?? 'unknown');
      }
    }
    reloadWidget();
    console.warn('[Duva BG] reloadWidget invoked');
    if (!updateOk) return Result.Failed;
  } catch (e) {
    console.warn('[Duva BG] exception:', e?.message || e);
    return Result.Failed;
  }
  return Result.NewData;
}

TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, runBackgroundNotificationTask);

/** Extract widget payload from notification data (used when app is running). */
function getWidgetPayloadFromNotification(notification) {
  const d = notification?.request?.content?.data;
  if (!d) return { photoUrl: null, caption: '' };
  return {
    photoUrl: d.photoUrl ?? null,
    caption: typeof d.caption === 'string' ? d.caption : '',
  };
}

/** Update widget using photoUrl from push payload. No API call - works in background. */
async function updateWidgetFromPhotoUrl(photoUrl, caption = '') {
  try {
    const sharedPath = getAppGroupDirectory(APP_GROUP_ID);
    if (!sharedPath) return;
    if (!photoUrl || typeof photoUrl !== 'string' || photoUrl.trim() === '') {
      await clearWidgetImageFiles(sharedPath);
      await writeCaptionToAppGroup('');
    } else {
      await downloadToAppGroup(photoUrl, caption);
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
  // Re-register background notification task on every boot.
  if (Notifications?.isTaskRegisteredAsync && Notifications?.registerTaskAsync) {
    Notifications.isTaskRegisteredAsync(BACKGROUND_NOTIFICATION_TASK)
      .then((isRegistered) => {
        if (!isRegistered) return Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK);
      })
      .catch(() => {});
  }

  // Remove any existing listener before adding a new one.
  // Without this, each app launch stacks an extra listener and they race
  // each other on the same notification (causing write conflicts after reopen).
  if (_notificationSubscription) {
    try { _notificationSubscription.remove(); } catch (_) {}
    _notificationSubscription = null;
  }

  _notificationSubscription = Notifications.addNotificationReceivedListener((notification) => {
    const dataType = notification?.request?.content?.data?.type;
    const { photoUrl, caption } = getWidgetPayloadFromNotification(notification);
    if (dataType === 'new_photo' || dataType === 'widget_update') {
      if (photoUrl !== null && photoUrl !== undefined) {
        updateWidgetFromPhotoUrl(photoUrl, caption);
      } else {
        TaskManager.runTaskAsync(TASK_NAME, {}).catch(() => {});
      }
    } else {
      const isSilent =
        notification?.request?.content?.data?.contentAvailable === true ||
        (!notification?.request?.content?.title &&
          !notification?.request?.content?.body);
      if (isSilent && photoUrl != null) {
        updateWidgetFromPhotoUrl(photoUrl, caption);
      } else if (isSilent) {
        TaskManager.runTaskAsync(TASK_NAME, {}).catch(() => {});
      }
    }
  });
}

export { TASK_NAME, BACKGROUND_NOTIFICATION_TASK };
