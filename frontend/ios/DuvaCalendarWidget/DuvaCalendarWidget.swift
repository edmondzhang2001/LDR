import WidgetKit
import SwiftUI

struct CalendarData: Codable {
    let daysRemaining: Int
}

struct CalendarEntry: TimelineEntry {
    let date: Date
    let daysRemaining: Int
}

struct CalendarProvider: TimelineProvider {
    func placeholder(in context: Context) -> CalendarEntry {
        CalendarEntry(date: Date(), daysRemaining: 0)
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
        guard let sharedURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup),
              let data = try? Data(contentsOf: sharedURL.appendingPathComponent("calendar.json")),
              let decoded = try? JSONDecoder().decode(CalendarData.self, from: data) else {
            return CalendarEntry(date: Date(), daysRemaining: 0)
        }
        return CalendarEntry(date: Date(), daysRemaining: decoded.daysRemaining)
    }
}

struct DuvaCalendarWidgetEntryView : View {
    var entry: CalendarEntry

    var body: some View {
        VStack(spacing: 4) {
            Text("SEEING THEM IN")
                .font(.system(size: 10, weight: .black))
                .tracking(2)
                .foregroundColor(.gray)
            
            Text("\(entry.daysRemaining)")
                .font(.system(size: 60, weight: .ultraLight, design: .serif))
            
            Text(entry.daysRemaining == 1 ? "DAY" : "DAYS")
                .font(.system(size: 12, weight: .bold))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(red: 255/255, green: 248/255, blue: 245/255))
    }
}

struct DuvaCalendarWidget: Widget {
    let kind: String = "DuvaCalendarWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: CalendarProvider()) { entry in
            if #available(iOS 17.0, *) {
                DuvaCalendarWidgetEntryView(entry: entry)
                    .containerBackground(.fill.tertiary, for: .widget)
            } else {
                DuvaCalendarWidgetEntryView(entry: entry)
            }
        }
        .configurationDisplayName("Duva Countdown")
        .description("Days until you meet again.")
        .supportedFamilies([.systemSmall])
    }
}
