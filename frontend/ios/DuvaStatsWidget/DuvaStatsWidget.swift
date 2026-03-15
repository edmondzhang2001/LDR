import WidgetKit
import SwiftUI

// 1. The Data Model (Matches your JSON)
struct StatsData: Codable {
    let name: String
    let streak: Int
}

// 2. The Timeline Entry
struct StatsEntry: TimelineEntry {
    let date: Date
    let name: String
    let streak: Int
}

// 3. The Provider (The "Brain")
struct StatsProvider: TimelineProvider {
    func placeholder(in context: Context) -> StatsEntry {
        StatsEntry(date: Date(), name: "Partner", streak: 0)
    }

    func getSnapshot(in context: Context, completion: @escaping (StatsEntry) -> ()) {
        let entry = getLatestEntry()
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<StatsEntry>) -> ()) {
        let entry = getLatestEntry()
        let timeline = Timeline(entries: [entry], policy: .never)
        completion(timeline)
    }
    
    // Helper to read the stats.json we write from React Native
    private func getLatestEntry() -> StatsEntry {
        let appGroup = "group.com.edmond.duva"
        let defaultEntry = StatsEntry(date: Date(), name: "Partner", streak: 0)
        
        guard let sharedURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup) else {
            return defaultEntry
        }
        
        let jsonURL = sharedURL.appendingPathComponent("stats.json")
        if let data = try? Data(contentsOf: jsonURL),
           let stats = try? JSONDecoder().decode(StatsData.self, from: data) {
            return StatsEntry(date: Date(), name: stats.name, streak: stats.streak)
        }
        
        return defaultEntry
    }
}

// 4. The View (The "Face")
struct DuvaStatsWidgetEntryView : View {
    var entry: StatsProvider.Entry

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "flame.fill")
                    .foregroundColor(.orange)
                Text("Streak")
                    .font(.caption)
                    .fontWeight(.bold)
                    .foregroundColor(.black)
            }
            
            Text("\(entry.streak) Days")
                .font(.system(size: 32, weight: .heavy, design: .rounded))
                .foregroundColor(.black)
            
            Text("with \(entry.name.split(separator: " ").first.map(String.init) ?? entry.name)")
                .font(.caption)
                .foregroundColor(Color(white: 0.35))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .padding()
        // Duva Brand Blush Background
        .background(Color(red: 255/255, green: 248/255, blue: 245/255))
    }
}

// 5. The Widget Configuration (The "ID Card")
struct DuvaStatsWidget: Widget {
    let kind: String = "DuvaStatsWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: StatsProvider()) { entry in
            if #available(iOS 17.0, *) {
                DuvaStatsWidgetEntryView(entry: entry)
                    .containerBackground(Color(red: 255/255, green: 248/255, blue: 245/255), for: .widget)
            } else {
                DuvaStatsWidgetEntryView(entry: entry)
            }
        }
        .configurationDisplayName("Duva Stats")
        .description("Keep track of your daily streak.")
        .supportedFamilies([.systemSmall])
        .contentMarginsDisabled()
    }
}
