import WidgetKit
import SwiftUI

// Theme (from frontend/src/theme/colors.js)
private let colorCream = Color(red: 255/255, green: 248/255, blue: 245/255)       // #FFF8F5
private let colorBlushDark = Color(red: 232/255, green: 180/255, blue: 184/255)  // #E8B4B8
private let colorSkyDark = Color(red: 155/255, green: 196/255, blue: 226/255)    // #9BC4E2
private let colorText = Color(red: 92/255, green: 74/255, blue: 74/255)            // #5C4A4A
private let colorTextMuted = Color(red: 139/255, green: 123/255, blue: 123/255)   // #8B7B7B

// 1. Data model (matches stats.json from React Native)
struct StatsData: Codable {
    let name: String?
    let streak: Int?
    let location: String?
    let partnerTime: String?
    let weatherTemp: String?
    let weatherIcon: String?
}

// 2. Timeline entry
struct StatsEntry: TimelineEntry {
    let date: Date
    let name: String
    let streak: Int
    let location: String?
    let partnerTime: String?
    let weatherTemp: String?
    let weatherIcon: String?
}

// 3. Provider
struct StatsProvider: TimelineProvider {
    func placeholder(in context: Context) -> StatsEntry {
        StatsEntry(date: Date(), name: "Partner", streak: 0, location: nil, partnerTime: nil, weatherTemp: nil, weatherIcon: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (StatsEntry) -> ()) {
        completion(getLatestEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<StatsEntry>) -> ()) {
        let timeline = Timeline(entries: [getLatestEntry()], policy: .never)
        completion(timeline)
    }

    private func getLatestEntry() -> StatsEntry {
        let appGroup = "group.com.edmond.duva"
        let defaultEntry = StatsEntry(date: Date(), name: "Partner", streak: 0, location: nil, partnerTime: nil, weatherTemp: nil, weatherIcon: nil)

        guard let sharedURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup) else {
            return defaultEntry
        }

        let jsonURL = sharedURL.appendingPathComponent("stats.json")
        guard let data = try? Data(contentsOf: jsonURL),
              let stats = try? JSONDecoder().decode(StatsData.self, from: data) else {
            return defaultEntry
        }

        let name = stats.name?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
            ? stats.name!
            : "Partner"
        let streak = stats.streak ?? 0
        let location = stats.location?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
            ? stats.location
            : nil
        let partnerTime = stats.partnerTime?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
            ? stats.partnerTime
            : nil
        let weatherTemp = stats.weatherTemp?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
            ? stats.weatherTemp
            : nil
        let weatherIcon = stats.weatherIcon

        return StatsEntry(
            date: Date(),
            name: name,
            streak: streak,
            location: location,
            partnerTime: partnerTime,
            weatherTemp: weatherTemp,
            weatherIcon: weatherIcon
        )
    }
}

/// Map OpenWeather icon code (e.g. "02d") to SF Symbol name.
private func sfSymbolForWeatherIcon(_ icon: String?) -> String {
    guard let icon = icon, icon.count >= 2 else { return "cloud.sun.fill" }
    let code = String(icon.prefix(2))
    switch code {
    case "01": return "sun.max.fill"
    case "02": return "cloud.sun.fill"
    case "03", "04": return "cloud.fill"
    case "09", "10": return "cloud.rain.fill"
    case "11": return "cloud.bolt.fill"
    case "13": return "cloud.snow.fill"
    case "50": return "cloud.fog.fill"
    default: return "cloud.sun.fill"
    }
}

// 4. View — title (partner name) + location, time, weather in theme style
struct DuvaStatsWidgetEntryView: View {
    var entry: StatsProvider.Entry

    private var partnerFirstName: String {
        entry.name.split(separator: " ").first.map(String.init) ?? "Partner"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(partnerFirstName)
                .font(.system(size: 12, weight: .semibold, design: .rounded))
                .foregroundColor(colorTextMuted)
                .textCase(.uppercase)
                .tracking(0.5)
                .padding(.bottom, 12)

            VStack(alignment: .leading, spacing: 16) {
                // Location row
                HStack(spacing: 12) {
                    Image(systemName: "location.fill")
                        .font(.system(size: 22))
                        .foregroundColor(colorBlushDark)
                    Text(entry.location ?? "—")
                        .font(.system(size: 20, weight: .semibold, design: .rounded))
                        .foregroundColor(colorText)
                        .lineLimit(1)
                }

                // Time row
                HStack(spacing: 12) {
                    Image(systemName: "clock.fill")
                        .font(.system(size: 22))
                        .foregroundColor(colorBlushDark)
                    Text(entry.partnerTime ?? "—")
                        .font(.system(size: 20, weight: .semibold, design: .rounded))
                        .foregroundColor(colorText)
                }

                // Weather row
                HStack(spacing: 12) {
                    Image(systemName: sfSymbolForWeatherIcon(entry.weatherIcon))
                        .font(.system(size: 22))
                        .foregroundColor(colorSkyDark)
                    Text(entry.weatherTemp ?? "—")
                        .font(.system(size: 20, weight: .semibold, design: .rounded))
                        .foregroundColor(colorText)
                }
            }

            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .padding(16)
        .background(colorCream)
    }
}

// 5. Widget configuration
struct DuvaStatsWidget: Widget {
    let kind: String = "DuvaStatsWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: StatsProvider()) { entry in
            if #available(iOS 17.0, *) {
                DuvaStatsWidgetEntryView(entry: entry)
                    .containerBackground(colorCream, for: .widget)
            } else {
                DuvaStatsWidgetEntryView(entry: entry)
            }
        }
        .configurationDisplayName("Duva Stats")
        .description("Partner's location, time, and weather.")
        .supportedFamilies([.systemSmall])
        .contentMarginsDisabled()
    }
}
