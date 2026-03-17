import WidgetKit
import SwiftUI
import ImageIO

// App theme colors (from frontend/src/theme/colors.js)
private let colorCream = Color(red: 255/255, green: 248/255, blue: 245/255)     // #FFF8F5
// Dark background when no photo — darker tone from theme (text/blush family), keeps white text readable
private let colorNoPhotoBackground = Color(red: 107/255, green: 90/255, blue: 94/255)  // #6B5A5E

struct CalendarData: Codable {
    let daysRemaining: Int
    let partnerFirstName: String?
    let partnerName: String?
}

struct CalendarEntry: TimelineEntry {
    let date: Date
    let daysRemaining: Int
    let partnerName: String?
    let image: UIImage?
}

struct CalendarProvider: TimelineProvider {
    private static let imageMaxPixelSize = 700

    func placeholder(in context: Context) -> CalendarEntry {
        CalendarEntry(date: Date(), daysRemaining: 0, partnerName: nil, image: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (CalendarEntry) -> ()) {
        completion(getLatestEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<CalendarEntry>) -> ()) {
        let timeline = Timeline(entries: [getLatestEntry()], policy: .never)
        completion(timeline)
    }
    
    private func getLatestEntry() -> CalendarEntry {
        let appGroup = "group.com.edmond.duva"
        guard let sharedURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup) else {
            return CalendarEntry(date: Date(), daysRemaining: 0, partnerName: nil, image: nil)
        }
        var daysRemaining = 0
        var partnerName: String? = nil
        if let data = try? Data(contentsOf: sharedURL.appendingPathComponent("calendar.json")),
           let decoded = try? JSONDecoder().decode(CalendarData.self, from: data) {
            daysRemaining = decoded.daysRemaining
            partnerName = decoded.partnerFirstName ?? decoded.partnerName
        }
        let imageURL = sharedURL.appendingPathComponent("calendar_widget_photo.jpg")
        let image = downsampleImage(at: imageURL, maxPixelSize: Self.imageMaxPixelSize)
        return CalendarEntry(date: Date(), daysRemaining: daysRemaining, partnerName: partnerName, image: image)
    }

    /// Decode a scaled bitmap directly to avoid loading full-resolution camera photos in memory.
    private func downsampleImage(at url: URL, maxPixelSize: Int) -> UIImage? {
        let sourceOptions: CFDictionary = [
            kCGImageSourceShouldCache: false
        ] as CFDictionary

        guard let source = CGImageSourceCreateWithURL(url as CFURL, sourceOptions) else { return nil }

        let thumbnailOptions: CFDictionary = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceThumbnailMaxPixelSize: maxPixelSize,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceShouldCacheImmediately: true
        ] as CFDictionary

        guard let cgImage = CGImageSourceCreateThumbnailAtIndex(source, 0, thumbnailOptions) else { return nil }
        return UIImage(cgImage: cgImage)
    }
}

struct DuvaCalendarWidgetEntryView : View {
    var entry: CalendarEntry

    private var partnerLabel: String {
        guard let full = entry.partnerName?.trimmingCharacters(in: .whitespaces), !full.isEmpty else {
            return "SEEING THEM IN"
        }
        let first = full.split(separator: " ").first.map(String.init) ?? full
        return "SEEING \(first.uppercased()) IN"
    }

    var body: some View {
        ZStack {
            if let uiImage = entry.image {
                Image(uiImage: uiImage)
                    .resizable()
                    .scaledToFill()
                    .overlay(Color.black.opacity(0.5))
            } else {
                colorNoPhotoBackground
            }
            
            VStack(spacing: 4) {
                Text(partnerLabel)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundColor(.white)
                    .tracking(2)
                    .multilineTextAlignment(.center)
                
                Text("\(entry.daysRemaining)")
                    .font(.system(size: 48, weight: .heavy))
                    .foregroundColor(.white)
                
                Text(entry.daysRemaining == 1 ? "DAY" : "DAYS")
                    .font(.system(size: 20, weight: .bold))
                    .foregroundColor(.white)
            }
            .shadow(color: .black.opacity(0.3), radius: 2, x: 0, y: 1)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct DuvaCalendarWidget: Widget {
    let kind: String = "DuvaCalendarWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: CalendarProvider()) { entry in
            if #available(iOS 17.0, *) {
                DuvaCalendarWidgetEntryView(entry: entry)
                    .containerBackground(entry.image == nil ? colorNoPhotoBackground : colorCream, for: .widget)
            } else {
                DuvaCalendarWidgetEntryView(entry: entry)
            }
        }
        .configurationDisplayName("Duva Countdown")
        .description("Days until you meet again.")
        .supportedFamilies([.systemSmall])
        .contentMarginsDisabled()
    }
}
