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
    let dataPayload = userInfo["data"] as? [String: Any]
    let directPhotoUrl = userInfo["photoUrl"] as? String
    let nestedPhotoUrl = dataPayload?["photoUrl"] as? String
    let photoUrl = (directPhotoUrl ?? nestedPhotoUrl ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    let caption = ((userInfo["caption"] as? String) ?? (dataPayload?["caption"] as? String) ?? "")
      .trimmingCharacters(in: .whitespacesAndNewlines)

    guard !photoUrl.isEmpty, let remoteURL = URL(string: photoUrl) else {
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
