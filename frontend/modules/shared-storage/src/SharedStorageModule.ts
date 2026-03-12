import { NativeModule, requireNativeModule } from 'expo';

import { SharedStorageModuleEvents } from './SharedStorage.types';

declare class SharedStorageModule extends NativeModule<SharedStorageModuleEvents> {
  PI: number;
  hello(): string;
  setValueAsync(value: string): Promise<void>;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<SharedStorageModule>('SharedStorage');
