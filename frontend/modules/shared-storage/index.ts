import { requireNativeModule } from 'expo-modules-core';
const SharedStorage = requireNativeModule('SharedStorage');
export function getAppGroupDirectory(groupId: string): string | null {
  return SharedStorage.getAppGroupDirectory(groupId);
}
export function reloadWidget(): void {
  SharedStorage.reloadWidget();
}

export async function updateWidgetPhotoFromUrl(url: string, caption: string, groupId: string): Promise<boolean> {
  if (!url || typeof url !== 'string') return false;
  if (!SharedStorage?.updateWidgetPhotoFromUrl) return false;
  try {
    return !!(await SharedStorage.updateWidgetPhotoFromUrl(url, caption || '', groupId));
  } catch {
    return false;
  }
}
