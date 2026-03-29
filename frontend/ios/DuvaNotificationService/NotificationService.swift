import Foundation
import os
import UserNotifications
import WidgetKit

final class NotificationService: UNNotificationServiceExtension {
  private static let logger = Logger(subsystem: "com.edmond.duva", category: "NotificationService")
  private var contentHandler: ((UNNotificationContent) -> Void)?
  private var bestAttemptContent: UNMutableNotificationContent?

  private let appGroupId = "group.com.edmond.duva"

  override func didReceive(
    _ request: UNNotificationRequest,
    withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
  ) {
    Self.logger.log("NSE didReceive started")
    self.contentHandler = contentHandler
    bestAttemptContent = (request.content.mutableCopy() as? UNMutableNotificationContent)

    guard let bestAttemptContent else {
      Self.logger.error("NSE could not create mutable notification content")
      contentHandler(request.content)
      return
    }

    let userInfo = request.content.userInfo

    // Diagnostic: log the raw payload structure
    let topLevelKeys = userInfo.keys.map { "\($0)" }.sorted().joined(separator: ", ")
    Self.logger.log("NSE userInfo keys: \(topLevelKeys, privacy: .public)")

    // Expo serializes all notification content (including custom data) into a top-level `body`
    // field. `body` may be a JSON string or a dictionary.
    var expoBody: [String: Any]? = nil
    if let bodyDict = userInfo["body"] as? [String: Any] {
      expoBody = bodyDict
      Self.logger.log("NSE body is a dict, keys: \(bodyDict.keys.sorted().joined(separator: ", "), privacy: .public)")
    } else if let bodyString = userInfo["body"] as? String {
      let preview = String(bodyString.prefix(300))
      Self.logger.log("NSE body is a string: \(preview, privacy: .public)")
      if let bodyData = bodyString.data(using: .utf8),
         let parsed = try? JSONSerialization.jsonObject(with: bodyData) as? [String: Any] {
        expoBody = parsed
        Self.logger.log("NSE body parsed as JSON, keys: \(parsed.keys.sorted().joined(separator: ", "), privacy: .public)")
      } else {
        Self.logger.error("NSE body string could not be parsed as JSON")
      }
    } else {
      Self.logger.error("NSE body is nil or unexpected type: \(type(of: userInfo["body"]), privacy: .public)")
    }

    // The user-supplied `data` dict is nested under expoBody["data"],
    // but Expo also flattens it directly into body in some SDK versions.
    let expoDataPayload = expoBody?["data"] as? [String: Any]
    // Also check the legacy top-level `data` key and double-nested variant
    let dataPayload = userInfo["data"] as? [String: Any]
    let innerDataPayload = dataPayload?["data"] as? [String: Any]

    let dataKeys = expoDataPayload?.keys.sorted().joined(separator: ", ") ?? "nil"
    Self.logger.log("NSE expoBody data keys: \(dataKeys, privacy: .public)")

    let directPhotoUrl  = userInfo["photoUrl"] as? String
    let bodyFlatUrl     = expoBody?["photoUrl"] as? String
    let bodyNestedUrl   = expoDataPayload?["photoUrl"] as? String
    let nestedPhotoUrl  = dataPayload?["photoUrl"] as? String
    let doubleNestedUrl = innerDataPayload?["photoUrl"] as? String
    let photoUrl = (directPhotoUrl ?? bodyFlatUrl ?? bodyNestedUrl ?? nestedPhotoUrl ?? doubleNestedUrl ?? "")
      .trimmingCharacters(in: .whitespacesAndNewlines)

    let caption = ((userInfo["caption"] as? String)
      ?? (expoBody?["caption"] as? String)
      ?? (expoDataPayload?["caption"] as? String)
      ?? (dataPayload?["caption"] as? String)
      ?? (innerDataPayload?["caption"] as? String)
      ?? "").trimmingCharacters(in: .whitespacesAndNewlines)

    guard !photoUrl.isEmpty, let remoteURL = URL(string: photoUrl) else {
      Self.logger.error("NSE test")
      Self.logger.error("NSE missing/invalid photoUrl in payload")
      contentHandler(bestAttemptContent)
      return
    }
    Self.logger.log("NSE parsed photoUrl successfully")

    guard let sharedDir = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupId) else {
      Self.logger.error("NSE could not resolve App Group directory")
      contentHandler(bestAttemptContent)
      return
    }
    Self.logger.log("NSE app group resolved: \(sharedDir.path, privacy: .public)")

    var req = URLRequest(url: remoteURL)
    req.timeoutInterval = 10
    req.cachePolicy = .reloadIgnoringLocalCacheData

    let task = URLSession.shared.dataTask(with: req) { [weak self] data, response, _ in
      guard let self else { return }
      defer { contentHandler(bestAttemptContent) }

      guard
        let data,
        !data.isEmpty,
        let http = response as? HTTPURLResponse,
        (200...299).contains(http.statusCode)
      else {
        let status = (response as? HTTPURLResponse)?.statusCode ?? -1
        Self.logger.error("NSE download failed. HTTP status: \(status)")
        return
      }
      Self.logger.log("NSE download succeeded, bytes: \(data.count)")

      let fileName = "current_widget_photo_\(Int(Date().timeIntervalSince1970 * 1000)).jpg"
      let imageURL = sharedDir.appendingPathComponent(fileName)
      let fallbackURL = sharedDir.appendingPathComponent("current_widget_photo.jpg")
      let pointerURL = sharedDir.appendingPathComponent("current_widget_photo_active.txt")
      try? FileManager.default.removeItem(at: imageURL)
      try? FileManager.default.removeItem(at: fallbackURL)
      do {
        try data.write(to: imageURL, options: .atomic)
        try? data.write(to: fallbackURL, options: .atomic)
        try? fileName.write(to: pointerURL, atomically: true, encoding: .utf8)
      } catch {
        Self.logger.error("NSE failed writing image to app group")
        return
      }
      Self.logger.log("NSE wrote widget image to app group")

      let captionURL = sharedDir.appendingPathComponent("current_widget_photo_caption.txt")
      if caption.isEmpty {
        try? FileManager.default.removeItem(at: captionURL)
        Self.logger.log("NSE removed caption file")
      } else {
        try? caption.write(to: captionURL, atomically: true, encoding: .utf8)
        Self.logger.log("NSE wrote caption file")
      }

      if #available(iOS 14.0, *) {
        WidgetCenter.shared.reloadTimelines(ofKind: "DuvaImageWidget")
        Self.logger.log("NSE requested widget timeline reload")
      }
    }
    task.resume()
  }

  override func serviceExtensionTimeWillExpire() {
    Self.logger.error("NSE time expired before completion")
    if let contentHandler, let bestAttemptContent {
      contentHandler(bestAttemptContent)
    }
  }
}
