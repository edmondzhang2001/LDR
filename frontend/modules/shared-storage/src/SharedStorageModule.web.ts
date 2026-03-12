import { registerWebModule, NativeModule } from 'expo';

import { ChangeEventPayload } from './SharedStorage.types';

type SharedStorageModuleEvents = {
  onChange: (params: ChangeEventPayload) => void;
}

class SharedStorageModule extends NativeModule<SharedStorageModuleEvents> {
  PI = Math.PI;
  async setValueAsync(value: string): Promise<void> {
    this.emit('onChange', { value });
  }
  hello() {
    return 'Hello world! 👋';
  }
};

export default registerWebModule(SharedStorageModule, 'SharedStorageModule');
