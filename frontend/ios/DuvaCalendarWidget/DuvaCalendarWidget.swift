import WidgetKit
import SwiftUI

// App theme colors (from frontend/src/theme/colors.js)
private let colorText = Color(red: 92/255, green: 74/255, blue: 74/255)      // #5C4A4A
private let colorTextMuted = Color(red: 139/255, green: 123/255, blue: 123/255)  // #8B7B7B
private let colorSkyDark = Color(red: 155/255, green: 196/255, blue: 226/255)   // #9BC4E2
private let colorCream = Color(red: 255/255, green: 248/255, blue: 245/255)     // #FFF8F5

struct CalendarData: Codable {
    let daysRemaining: Int
    let partnerName: String?
}

struct CalendarEntry: TimelineEntry {
    let date: Date
    let daysRemaining: Int
    let partnerName: String?
    let image: UIImage?
}

struct CalendarProvider: TimelineProvider {
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
            partnerName = decoded.partnerName
        }
        let imageURL = sharedURL.appendingPathComponent("calendar_widget_photo.jpg")
        let image: UIImage? = (try? Data(contentsOf: imageURL, options: .uncached)).flatMap { UIImage(data: $0) }
        return CalendarEntry(date: Date(), daysRemaining: daysRemaining, partnerName: partnerName, image: image)
    }
}

struct DuvaCalendarWidgetEntryView : View {
    var entry: CalendarEntry

    private var partnerLabel: String {
        let name = entry.partnerName?.trimmingCharacters(in: .whitespaces).uppercased()
        if let n = name, !n.isEmpty {
            return "SEEING \(n) IN"
        }
        return "SEEING THEM IN"
    }

    var body: some View {
        ZStack {
            if let uiImage = entry.image {
                Image(uiImage: uiImage)
                    .resizable()
                    .scaledToFill()
                    .blur(radius: 40)
                    .overlay(
                        LinearGradient(
                            colors: [colorCream.opacity(0.85), colorCream.opacity(0.7)],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
            } else {
                colorCream
            }
            
            VStack(spacing: 4) {
                Text(partnerLabel)
                    .font(.system(size: 10, weight: .black))
                    .tracking(2)
                    .foregroundColor(colorTextMuted)
                    .multilineTextAlignment(.center)
                
                Text("\(entry.daysRemaining)")
                    .font(.system(size: 48, weight: .heavy, design: .rounded))
                    .foregroundColor(colorText)
                
                Text(entry.daysRemaining == 1 ? "DAY" : "DAYS")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundColor(colorText)
            }
            .shadow(color: .black.opacity(0.1), radius: 2, x: 0, y: 1)
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
                    .containerBackground(colorCream, for: .widget)
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
