import ExpoModulesCore
import Foundation
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
    DispatchQueue.main.async {
      WidgetCenter.shared.reloadTimelines(ofKind: "DuvaImageWidget")
    }
  }
}

AsyncFunction("updateWidgetPhotoFromUrl") { (urlString: String, caption: String, groupId: String) async -> Bool in
  guard let sharedDir = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: groupId) else {
    return false
  }
  guard let remoteURL = URL(string: urlString.trimmingCharacters(in: .whitespacesAndNewlines)) else {
    return false
  }

  var request = URLRequest(url: remoteURL)
  request.timeoutInterval = 10
  request.cachePolicy = .reloadIgnoringLocalCacheData

  do {
    let (data, response) = try await URLSession.shared.data(for: request)
    guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode), !data.isEmpty else {
      return false
    }

    let fileName = "current_widget_photo_\(Int(Date().timeIntervalSince1970 * 1000)).jpg"
    let imageURL = sharedDir.appendingPathComponent(fileName)
    let fallbackURL = sharedDir.appendingPathComponent("current_widget_photo.jpg")
    let pointerURL = sharedDir.appendingPathComponent("current_widget_photo_active.txt")
    try? FileManager.default.removeItem(at: imageURL)
    try? FileManager.default.removeItem(at: fallbackURL)
    try data.write(to: imageURL, options: .atomic)
    // Keep fallback path for older readers.
    try? data.write(to: fallbackURL, options: .atomic)
    try fileName.write(to: pointerURL, atomically: true, encoding: .utf8)

    let normalizedCaption = caption.trimmingCharacters(in: .whitespacesAndNewlines)
    let captionURL = sharedDir.appendingPathComponent("current_widget_photo_caption.txt")
    if normalizedCaption.isEmpty {
      try? FileManager.default.removeItem(at: captionURL)
    } else {
      try normalizedCaption.write(to: captionURL, atomically: true, encoding: .utf8)
    }

    // Reload widget immediately here, atomically with the write.
    // This is more reliable than relying on a separate JS reloadWidget() call.
    if #available(iOS 14.0, *) {
      DispatchQueue.main.async {
        WidgetCenter.shared.reloadTimelines(ofKind: "DuvaImageWidget")
      }
    }
    return true
  } catch {
    return false
  }
}


}
}
