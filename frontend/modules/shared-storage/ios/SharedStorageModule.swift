import ExpoModulesCore
import WidgetKit
public class SharedStorageModule: Module {
public func definition() -> ModuleDefinition {
Name("SharedStorage")

Function("getAppGroupDirectory") { (groupId: String) -> String? in
  if let sharedDir = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: groupId) {
    return sharedDir.path
  }
  return nil
}
Function("reloadWidget") {
if #available(iOS 14.0, *) {
WidgetCenter.shared.reloadAllTimelines()
}
}


}
}
