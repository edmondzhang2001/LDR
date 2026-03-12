import WidgetKit
import SwiftUI

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> SimpleEntry {
        SimpleEntry(date: Date(), imagePath: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (SimpleEntry) -> ()) {
        let entry = SimpleEntry(date: Date(), imagePath: getImagePath())
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> ()) {
        let entry = SimpleEntry(date: Date(), imagePath: getImagePath())
        // .never means the widget only updates when our React Native app calls reloadWidget()
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
}

struct SimpleEntry: TimelineEntry {
    let date: Date
    let imagePath: String?
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
            } else {
                VStack {
                    Image(systemName: "photo.fill")
                        .font(.largeTitle)
                        .foregroundColor(.gray.opacity(0.5))
                    Text("No Photo Yet")
                        .font(.caption)
                        .foregroundColor(.gray)
                        .padding(.top, 2)
                }
            }
        }
        // This makes tapping the widget open your app natively!
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
