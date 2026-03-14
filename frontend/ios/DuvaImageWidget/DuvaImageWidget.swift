import WidgetKit
import SwiftUI

struct PartnerStats: Codable {
    let name: String?
    let streak: Int?
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> SimpleEntry {
        SimpleEntry(date: Date(), image: nil, stats: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (SimpleEntry) -> ()) {
        let entry = SimpleEntry(date: Date(), image: loadImage(), stats: loadStats())
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> ()) {
        let entry = SimpleEntry(date: Date(), image: loadImage(), stats: loadStats())
        // Fallback: re-check every 15 min in case a push-triggered reload was rate-limited
        let nextRefresh = Calendar.current.date(byAdding: .minute, value: 15, to: Date()) ?? Date()
        let timeline = Timeline(entries: [entry], policy: .after(nextRefresh))
        completion(timeline)
    }

    /// Load image data eagerly so the bytes are captured in the timeline entry (avoids stale file reads).
    private func loadImage() -> UIImage? {
        let appGroup = "group.com.edmond.duva"
        guard let sharedURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup) else { return nil }
        let imageURL = sharedURL.appendingPathComponent("current_widget_photo.jpg")
        // Read raw bytes to bypass any file-descriptor / cache staleness
        guard let data = try? Data(contentsOf: imageURL, options: .uncached) else { return nil }
        return UIImage(data: data)
    }

    private func loadStats() -> PartnerStats? {
        let appGroup = "group.com.edmond.duva"
        guard let sharedURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup) else { return nil }
        let jsonURL = sharedURL.appendingPathComponent("stats.json")
        guard let data = try? Data(contentsOf: jsonURL, options: .uncached),
              let stats = try? JSONDecoder().decode(PartnerStats.self, from: data) else { return nil }
        return stats
    }
}

struct SimpleEntry: TimelineEntry {
    let date: Date
    let image: UIImage?
    let stats: PartnerStats?
}

struct DuvaImageWidgetEntryView: View {
    var entry: Provider.Entry

    var body: some View {
        ZStack {
            Color(red: 255/255, green: 248/255, blue: 245/255)
            if let uiImage = entry.image {
                Image(uiImage: uiImage)
                    .resizable()
                    .scaledToFill()
                    .overlay(
                        Rectangle()
                            .stroke(Color.white, lineWidth: 8)
                    )
            } else {
                VStack(spacing: 8) {
                    Image(systemName: "heart.fill")
                        .font(.title)
                        .foregroundColor(.pink)

                    if let stats = entry.stats {
                        Text("Waiting for \(stats.name ?? "partner")...")
                            .font(.headline)
                            .foregroundColor(.black)
                            .multilineTextAlignment(.center)

                        Text("🔥 \(stats.streak ?? 0) Day Streak")
                            .font(.subheadline)
                            .foregroundColor(.gray)
                    } else {
                        Text("Connecting...")
                            .font(.headline)
                            .foregroundColor(.gray)
                    }
                }
                .padding()
            }
        }
        .widgetURL(URL(string: "duva://"))
    }
}

struct DuvaImageWidget: Widget {
    let kind: String = "DuvaImageWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            if #available(iOS 17.0, *) {
                DuvaImageWidgetEntryView(entry: entry)
                    .containerBackground(Color(red: 255/255, green: 248/255, blue: 245/255), for: .widget)
            } else {
                DuvaImageWidgetEntryView(entry: entry)
                    .padding()
                    .background()
            }
        }
        .configurationDisplayName("Duva Photo")
        .description("See the latest photo from your partner.")
        .supportedFamilies([.systemSmall, .systemLarge])
    }
}
