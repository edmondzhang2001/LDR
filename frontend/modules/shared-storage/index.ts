import { requireNativeModule } from 'expo-modules-core';
const SharedStorage = requireNativeModule('SharedStorage');
export function getAppGroupDirectory(groupId: string): string | null {
  return SharedStorage.getAppGroupDirectory(groupId);
}
export function reloadWidget(): void {
  SharedStorage.reloadWidget();
}
