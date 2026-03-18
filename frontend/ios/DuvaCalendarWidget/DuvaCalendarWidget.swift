import WidgetKit
import SwiftUI
import ImageIO

// App theme colors (from frontend/src/theme/colors.js)
private let colorCream = Color(red: 255/255, green: 248/255, blue: 245/255)     // #FFF8F5
// Dark background when no photo — darker tone from theme (text/blush family), keeps white text readable
private let colorNoPhotoBackground = Color(red: 107/255, green: 90/255, blue: 94/255)  // #6B5A5E

struct CalendarData: Codable {
    let daysRemaining: Int?
    let reunionDate: String?
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
        let nextRefresh = nextUtcMidnight(after: Date())
        let timeline = Timeline(entries: [getLatestEntry()], policy: .after(nextRefresh))
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
            if let reunionDate = decoded.reunionDate, let computedDays = computeDaysRemaining(from: reunionDate) {
                daysRemaining = max(0, computedDays)
            } else if let storedDays = decoded.daysRemaining {
                // Backward compatibility with older payloads that only stored a number.
                daysRemaining = max(0, storedDays)
            }
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

    private func computeDaysRemaining(from reunionDate: String) -> Int? {
        guard let targetDate = parseDateOnly(reunionDate) else { return nil }
        var utcCalendar = Calendar(identifier: .gregorian)
        utcCalendar.timeZone = TimeZone(secondsFromGMT: 0) ?? .current
        let startToday = utcCalendar.startOfDay(for: Date())
        let startTarget = utcCalendar.startOfDay(for: targetDate)
        return utcCalendar.dateComponents([.day], from: startToday, to: startTarget).day
    }

    private func parseDateOnly(_ value: String) -> Date? {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count >= 10 else { return nil }
        let datePrefix = String(trimmed.prefix(10))
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.date(from: datePrefix)
    }

    private func nextUtcMidnight(after date: Date) -> Date {
        var utcCalendar = Calendar(identifier: .gregorian)
        utcCalendar.timeZone = TimeZone(secondsFromGMT: 0) ?? .current
        let startOfToday = utcCalendar.startOfDay(for: date)
        guard let tomorrow = utcCalendar.date(byAdding: .day, value: 1, to: startOfToday),
              let refreshTime = utcCalendar.date(byAdding: .minute, value: 1, to: tomorrow) else {
            return date.addingTimeInterval(60 * 60)
        }
        return refreshTime
    }
}

struct DuvaCalendarWidgetEntryView : View {
    var entry: CalendarEntry
    @Environment(\.widgetFamily) private var family

    private var partnerLabel: String {
        guard let full = entry.partnerName?.trimmingCharacters(in: .whitespaces), !full.isEmpty else {
            return "SEEING THEM IN"
        }
        let first = full.split(separator: " ").first.map(String.init) ?? full
        return "SEEING \(first.uppercased()) IN"
    }

    private var partnerFirstName: String {
        guard let full = entry.partnerName?.trimmingCharacters(in: .whitespaces), !full.isEmpty else {
            return "them"
        }
        return full.split(separator: " ").first.map(String.init) ?? full
    }

    var body: some View {
        switch family {
        case .accessoryRectangular:
            accessoryRectangularView
        case .accessoryInline:
            Text("❤️ \(entry.daysRemaining) Days until \(partnerFirstName)")
                .widgetAccentable()
        default:
            homeScreenView
        }
    }

    private var accessoryRectangularView: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 4) {
                Image(systemName: "heart.fill")
                    .font(.headline)
                Text("\(entry.daysRemaining) Days")
                    .font(.headline)
            }
            Text("until we meet")
                .font(.caption)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }

    private var homeScreenView: some View {
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

private struct CalendarContainerBackgroundModifier: ViewModifier {
    let entry: CalendarEntry
    @Environment(\.widgetFamily) private var family

    func body(content: Content) -> some View {
        if #available(iOS 17.0, *) {
            let fill: some ShapeStyle = family == .systemSmall
                ? (entry.image == nil ? colorNoPhotoBackground : colorCream)
                : Color.clear
            content.containerBackground(fill, for: .widget)
        } else {
            content
        }
    }
}

struct DuvaCalendarWidget: Widget {
    let kind: String = "DuvaCalendarWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: CalendarProvider()) { entry in
            DuvaCalendarWidgetEntryView(entry: entry)
                .modifier(CalendarContainerBackgroundModifier(entry: entry))
        }
        .configurationDisplayName("Duva Countdown")
        .description("Days until you meet again.")
        .supportedFamilies([.systemSmall, .accessoryRectangular, .accessoryInline])
        .contentMarginsDisabled()
    }
}
