import WidgetKit
import SwiftUI
struct PartnerStats: Codable {
let name: String?
let streak: Int?
}

struct Provider: TimelineProvider {
func placeholder(in context: Context) -> SimpleEntry {
SimpleEntry(date: Date(), imagePath: nil, stats: nil)
}

func getSnapshot(in context: Context, completion: @escaping (SimpleEntry) -> ()) {
    let entry = SimpleEntry(date: Date(), imagePath: getImagePath(), stats: getPartnerStats())
    completion(entry)
}
func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> ()) {
    let entry = SimpleEntry(date: Date(), imagePath: getImagePath(), stats: getPartnerStats())
    let timeline = Timeline(entries: [entry], policy: .never)
    completion(timeline)
}
private func getImagePath() -> String? {
let appGroup = "group.com.edmond.duva"
if let sharedURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup) {
let imageURL = sharedURL.appendingPathComponent("current_widget_photo.jpg")
if FileManager.default.fileExists(atPath: imageURL.path) {
return imageURL.path
}
}
return nil
}

private func getPartnerStats() -> PartnerStats? {
let appGroup = "group.com.edmond.duva"
if let sharedURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup) {
let jsonURL = sharedURL.appendingPathComponent("stats.json")
if let data = try? Data(contentsOf: jsonURL),
let stats = try? JSONDecoder().decode(PartnerStats.self, from: data) {
return stats
}
}
return nil
}


}
struct SimpleEntry: TimelineEntry {
let date: Date
let imagePath: String?
let stats: PartnerStats?
}

struct DuvaImageWidgetEntryView : View {
var entry: Provider.Entry

var body: some View {
    ZStack {
        Color(red: 255/255, green: 248/255, blue: 245/255) // Duva Brand Blush
        if let path = entry.imagePath, let uiImage = UIImage(contentsOfFile: path) {
            Image(uiImage: uiImage)
                .resizable()
                .scaledToFill()
                // The Border
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
                .containerBackground(.fill.tertiary, for: .widget)
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
