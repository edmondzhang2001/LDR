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
    let batteryLevel: Double?  // 0...1 from partner API
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
    let batteryLevel: Double?  // 0...1
}

// 3. Provider
struct StatsProvider: TimelineProvider {
    func placeholder(in context: Context) -> StatsEntry {
        StatsEntry(date: Date(), name: "Partner", streak: 0, location: nil, partnerTime: nil, weatherTemp: nil, weatherIcon: nil, batteryLevel: nil)
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
        let defaultEntry = StatsEntry(date: Date(), name: "Partner", streak: 0, location: nil, partnerTime: nil, weatherTemp: nil, weatherIcon: nil, batteryLevel: nil)

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
        let batteryLevel = stats.batteryLevel

        return StatsEntry(
            date: Date(),
            name: name,
            streak: streak,
            location: location,
            partnerTime: partnerTime,
            weatherTemp: weatherTemp,
            weatherIcon: weatherIcon,
            batteryLevel: batteryLevel
        )
    }
}

/// SF Symbol name for battery level (0...1).
private func sfSymbolForBatteryLevel(_ level: Double?) -> String {
    guard let level = level, level >= 0, level <= 1 else { return "battery.100" }
    if level <= 0.25 { return "battery.0" }
    if level <= 0.5 { return "battery.25" }
    if level <= 0.75 { return "battery.50" }
    if level < 1.0 { return "battery.75" }
    return "battery.100"
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

    /// Long city names use smaller time/weather to leave room for location.
    private var isLongLocation: Bool {
        let loc = entry.location ?? ""
        return loc.count > 14
    }

    private var rowIconSize: CGFloat { isLongLocation ? 18 : 20 }
    private var locationFontSize: CGFloat { isLongLocation ? 18 : 20 }
    private var timeWeatherFontSize: CGFloat { isLongLocation ? 16 : 20 }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(partnerFirstName + ":")
                .font(.system(size: 14, weight: .semibold, design: .rounded))
                .foregroundColor(colorTextMuted)
                .textCase(.uppercase)
                .tracking(0.5)
                .padding(.bottom, 8)

            VStack(alignment: .leading, spacing: 8) {
                // Location row — use full width so text can wrap; scale down if needed to avoid hard cutoff
                HStack(alignment: .top, spacing: 8) {
                    Image(systemName: "location.fill")
                        .font(.system(size: rowIconSize))
                        .foregroundColor(colorBlushDark)
                    Text(entry.location ?? "—")
                        .font(.system(size: locationFontSize, weight: .semibold, design: .rounded))
                        .foregroundColor(colorText)
                        .lineLimit(2)
                        .minimumScaleFactor(0.65)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                // Time row — smaller font when location is long
                HStack(spacing: 8) {
                    Image(systemName: "clock.fill")
                        .font(.system(size: rowIconSize))
                        .foregroundColor(colorBlushDark)
                    Text(entry.partnerTime ?? "—")
                        .font(.system(size: timeWeatherFontSize, weight: .semibold, design: .rounded))
                        .foregroundColor(colorText)
                }

                // Weather row — smaller font when location is long
                HStack(spacing: 8) {
                    Image(systemName: sfSymbolForWeatherIcon(entry.weatherIcon))
                        .font(.system(size: rowIconSize))
                        .foregroundColor(colorSkyDark)
                    Text(entry.weatherTemp ?? "—")
                        .font(.system(size: timeWeatherFontSize, weight: .semibold, design: .rounded))
                        .foregroundColor(colorText)
                }

                // Battery row — partner's battery percentage (0...1 from API)
                if let level = entry.batteryLevel, level >= 0, level <= 1 {
                    HStack(spacing: 8) {
                        Image(systemName: sfSymbolForBatteryLevel(level))
                            .font(.system(size: rowIconSize))
                            .foregroundColor(colorBlushDark)
                        Text("\(Int(round(level * 100)))%")
                            .font(.system(size: timeWeatherFontSize, weight: .semibold, design: .rounded))
                            .foregroundColor(colorText)
                    }
                }
            }

            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .padding(12)
        .background(colorCream)
    }
}

private struct StatsContainerBackgroundModifier: ViewModifier {
    func body(content: Content) -> some View {
        if #available(iOS 17.0, *) {
            content.containerBackground(colorCream, for: .widget)
        } else {
            content
        }
    }
}

// 5. Widget configuration
struct DuvaStatsWidget: Widget {
    let kind: String = "DuvaStatsWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: StatsProvider()) { entry in
            DuvaStatsWidgetEntryView(entry: entry)
                .modifier(StatsContainerBackgroundModifier())
        }
        .configurationDisplayName("Duva Stats")
        .description("Partner's location, time, and weather.")
        .supportedFamilies([.systemSmall])
        .contentMarginsDisabled()
    }
}
