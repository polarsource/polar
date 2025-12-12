import WidgetKit
import SwiftUI
import Charts

struct Provider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> SimpleEntry {
        let placeholderData = generatePlaceholderData(days: 30)
        return SimpleEntry(date: Date(), configuration: ConfigurationAppIntent(), metricValue: 425, organizationName: "Acme Inc", chartData: placeholderData, lastUpdated: Date())
    }

    func snapshot(for configuration: ConfigurationAppIntent, in context: Context) async -> SimpleEntry {
        let defaults = UserDefaults(suiteName: "group.com.polarsource.Polar")
        let orgName = defaults?.string(forKey: "widget_organization_name")
        let days = configuration.timeFrame.days
        
        if let (metricValue, chartData) = await fetchMetrics(days: days, metricType: configuration.metricType) {
            return SimpleEntry(date: Date(), configuration: configuration, metricValue: metricValue, organizationName: orgName, chartData: chartData, lastUpdated: Date())
        }
        let placeholderData = generatePlaceholderData(days: days)
        return SimpleEntry(date: Date(), configuration: configuration, metricValue: 425, organizationName: orgName, chartData: placeholderData, lastUpdated: Date())
    }
    
    func timeline(for configuration: ConfigurationAppIntent, in context: Context) async -> Timeline<SimpleEntry> {
        let currentDate = Date()
        let defaults = UserDefaults(suiteName: "group.com.polarsource.Polar")
        let orgName = defaults?.string(forKey: "widget_organization_name")
        let days = configuration.timeFrame.days

        let (metricValue, chartData) = await fetchMetrics(days: days, metricType: configuration.metricType) ?? (182, generatePlaceholderData(days: days))
        
        let entry = SimpleEntry(date: currentDate, configuration: configuration, metricValue: metricValue, organizationName: orgName, chartData: chartData, lastUpdated: currentDate)
        
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 5, to: currentDate)!
        
        return Timeline(entries: [entry], policy: .after(nextUpdate))
    }
    
    func generatePlaceholderData(days: Int) -> [RevenueData] {
        return (1...days).map { day in
            let baseGrowth = Double(day) * 8
            let wave1 = sin(Double(day) * 0.3) * 40
            let wave2 = cos(Double(day) * 0.15) * 25
            let amount = max(10, baseGrowth + wave1 + wave2)
            return RevenueData(day: day, amount: amount)
        }
    }
    
    private func fetchMetrics(days: Int, metricType: MetricType) async -> (Int, [RevenueData])? {
        let defaults = UserDefaults(suiteName: "group.com.polarsource.Polar")
        guard let apiToken = defaults?.string(forKey: "widget_api_token"),
              let organizationId = defaults?.string(forKey: "widget_organization_id") else {
            return nil
        }
        
        let endDate = Date()
        guard let startDate = Calendar.current.date(byAdding: .day, value: -days, to: endDate) else {
            return nil
        }
        
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd"
        
        let startDateStr = dateFormatter.string(from: startDate)
        let endDateStr = dateFormatter.string(from: endDate)
        
        var components = URLComponents(string: "https://api.polar.sh/v1/metrics/")!
        components.queryItems = [
            URLQueryItem(name: "organization_id", value: organizationId),
            URLQueryItem(name: "start_date", value: startDateStr),
            URLQueryItem(name: "end_date", value: endDateStr),
            URLQueryItem(name: "interval", value: "day"),
            URLQueryItem(name: "timezone", value: TimeZone.current.identifier)
        ]
        
        guard let url = components.url else {
            return nil
        }
        
        var request = URLRequest(url: url)
        request.setValue("Bearer \(apiToken)", forHTTPHeaderField: "Authorization")
        
        do {
            let (data, _) = try await URLSession.shared.data(for: request)
            let decodedResponse = try JSONDecoder().decode(MetricsResponse.self, from: data)
            
            let metricValue: Int
            switch metricType {
            case .revenue:
                let revenueCents = decodedResponse.totals.revenue ?? 0
                metricValue = Int(Double(revenueCents) / 100.0)
            case .orders:
                metricValue = decodedResponse.totals.orders ?? 0
            }
            
            var cumulativeValue: Double = 0
            let chartData = decodedResponse.periods.enumerated().map { index, period -> RevenueData in
                let periodValue: Double
                switch metricType {
                case .revenue:
                    periodValue = Double(period.revenue ?? 0) / 100.0
                case .orders:
                    periodValue = Double(period.orders ?? 0)
                }
                cumulativeValue += periodValue
                
                return RevenueData(day: index + 1, amount: cumulativeValue)
            }
            
            return (metricValue, chartData)
            
        } catch {
            return nil
        }
    }
}

struct MetricsResponse: Codable {
    let totals: MetricsTotals
    let periods: [MetricsPeriod]
}

struct MetricsTotals: Codable {
    let revenue: Int?
    let orders: Int?
}

struct MetricsPeriod: Codable {
    let revenue: Int?
    let orders: Int?
}

struct SimpleEntry: TimelineEntry {
    let date: Date
    let configuration: ConfigurationAppIntent
    let metricValue: Int
    let organizationName: String?
    let chartData: [RevenueData]
    let lastUpdated: Date
}

struct RevenueData: Identifiable {
    let id = UUID()
    let day: Int
    let amount: Double
}

func formatCompactValue(_ value: Int) -> String {
    let absValue = abs(value)
    
    if absValue >= 1_000_000 {
        let millions = Double(absValue) / 1_000_000.0
        if millions >= 10 {
            return "$\(Int(millions))M"
        } else {
            return String(format: "$%.1fM", millions)
        }
    } else if absValue >= 1_000 {
        let thousands = Double(absValue) / 1_000.0
        if thousands >= 100 {
            return "$\(Int(thousands))k"
        } else if thousands >= 10 {
            return String(format: "$%.0fk", thousands)
        } else {
            return String(format: "$%.1fk", thousands)
        }
    } else {
        return "$\(absValue)"
    }
}

struct widgetEntryView : View {
    var entry: Provider.Entry
    @Environment(\.widgetFamily) var family
    @Environment(\.colorScheme) var colorScheme

    var body: some View {
        let maxValue = entry.chartData.map { $0.amount }.max() ?? 240
        let yAxisMax = maxValue * 1.2
        let timeFrameText = entry.configuration.timeFrame.rawValue
        let metricType = entry.configuration.metricType
        let metricLabel = metricType.rawValue
        let formattedValue = metricType == .revenue ? formatCompactValue(entry.metricValue) : "\(entry.metricValue)"
        
        // Adaptive colors based on color scheme
        let primaryTextColor: Color = colorScheme == .dark ? .white : .black
        let secondaryTextColor: Color = colorScheme == .dark ? .white.opacity(0.6) : .black.opacity(0.6)
        let logoImageName = colorScheme == .dark ? "PolarLogoWhite" : "PolarLogoBlack"
      
        return VStack(alignment: .leading, spacing: family == .systemSmall ? 4 : 2) {
            if family == .systemSmall {
                let shortTimeFrame = timeFrameText.replacingOccurrences(of: " days", with: "d")
                
                HStack(spacing: 4) {
                    Image(logoImageName)
                        .resizable()
                        .scaledToFit()
                        .frame(width: 16, height: 16)

                  Text("\(metricLabel)")
                              .font(.caption2)
                              .fontWeight(.medium)
                              .foregroundStyle(primaryTextColor)
                  
                    Spacer(minLength: 4)
                    
                    Text(formattedValue)
                        .font(.headline)
                        .fontWeight(.bold)
                        .foregroundStyle(primaryTextColor)
                }
                .padding(.horizontal, 6)
            } else {
                HStack(spacing: 10) {
                    Image(logoImageName)
                        .resizable()
                        .scaledToFit()
                        .frame(width: 24, height: 24)
                    
                    Text("\(metricLabel) | \(timeFrameText)")
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .foregroundStyle(primaryTextColor)
                    
                    Spacer()
                    
                    Text(formattedValue)
                        .font(.title)
                        .fontWeight(.bold)
                        .foregroundStyle(primaryTextColor)
                }
                .padding(.horizontal, family == .systemSmall ? 6 : 8)
            }
            
            Chart(entry.chartData) { data in
                LineMark(
                    x: .value("Day", data.day),
                    y: .value("Revenue", data.amount)
                )
                .interpolationMethod(.monotone)
                .foregroundStyle(
                    LinearGradient(
                        colors: [Color(hex: "005FFF"), Color(hex: "005FFF").opacity(0.7)],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .lineStyle(StrokeStyle(lineWidth: family == .systemSmall ? 2.5 : 3))
                
                AreaMark(
                    x: .value("Day", data.day),
                    y: .value("Revenue", data.amount)
                )
                .interpolationMethod(.monotone)
                .foregroundStyle(
                    LinearGradient(
                        colors: [Color(hex: "005FFF").opacity(0.3), Color(hex: "005FFF").opacity(0.05)],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
            }
            .chartXScale(domain: 1...entry.chartData.count)
            .chartYScale(domain: 0...yAxisMax)
            .chartXAxis(.hidden)
            .chartYAxis(.hidden)
            .frame(maxHeight: .infinity)
            .padding(.horizontal, family == .systemSmall ? 6 : 8)
        }
        .padding(.vertical, family == .systemSmall ? 0 : 10)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .unredacted()
    }
}

struct widget: Widget {
    let kind: String = "widget"

    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: kind, intent: ConfigurationAppIntent.self, provider: Provider()) { entry in
            widgetEntryView(entry: entry)
                .containerBackground(for: .widget) {
                    AdaptiveWidgetBackground()
                }
        }
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

struct AdaptiveWidgetBackground: View {
    @Environment(\.colorScheme) var colorScheme
    
    var body: some View {
        if colorScheme == .dark {
            LinearGradient(
                colors: [Color(red: 0.1, green: 0.1, blue: 0.15), Color(red: 0.05, green: 0.05, blue: 0.1)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        } else {
            LinearGradient(
                colors: [Color(red: 0.95, green: 0.95, blue: 0.97), Color(red: 0.90, green: 0.90, blue: 0.92)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        }
    }
}

struct LockScreenWidget: Widget {
    let kind: String = "LockScreenWidget"
    
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: kind, intent: ConfigurationAppIntent.self, provider: Provider()) { entry in
            LockScreenWidgetView(entry: entry)
        }
        .supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryInline])
        .configurationDisplayName("Polar Lock Screen")
        .description("Quick glance at your metrics.")
    }
}

struct LockScreenWidgetView: View {
    var entry: Provider.Entry
    @Environment(\.widgetFamily) var family
    
    var body: some View {
        switch family {
        case .accessoryCircular:
            circularView
        case .accessoryRectangular:
            rectangularView
        case .accessoryInline:
            inlineView
        default:
            EmptyView()
        }
    }
    
    private var circularView: some View {
        let metricType = entry.configuration.metricType
        let formattedValue = metricType == .revenue ? formatCompactValue(entry.metricValue) : "\(entry.metricValue)"
        let iconName = metricType == .revenue ? "chart.line.uptrend.xyaxis" : "chart.line.uptrend.xyaxis"
        
        return ZStack {
            AccessoryWidgetBackground()
            VStack(spacing: 1) {
                Image(systemName: iconName)
                    .font(.callout)
                Text(formattedValue)
                    .font(.caption2)
                    .fontWeight(.bold)
            }
        }
    }
    
    private var rectangularView: some View {
        let metricType = entry.configuration.metricType
        let formattedValue = metricType == .revenue ? formatCompactValue(entry.metricValue) : "\(entry.metricValue)"
        let timeFrameText = entry.configuration.timeFrame.rawValue
        
        return HStack(spacing: 8) {
            Image(systemName: "chart.line.uptrend.xyaxis")
                .font(.system(size: 32))
                .frame(maxHeight: .infinity)
            
            VStack(alignment: .leading, spacing: 0) {
                Text(formattedValue)
                    .font(.headline)
                    .fontWeight(.bold)
                Text("Past \(timeFrameText)")
                    .font(.system(size: 10))
                    .foregroundStyle(.secondary)
            }
            
            Spacer()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
    
    private var inlineView: some View {
        let metricType = entry.configuration.metricType
        let formattedValue = metricType == .revenue ? formatCompactValue(entry.metricValue) : "\(entry.metricValue)"
        
        return Text("\(metricType.rawValue): \(formattedValue)")
    }
}

#Preview(as: .systemSmall) {
    widget()
} timeline: {
    let placeholderData = (1...30).map { i in RevenueData(day: i, amount: Double(i * 10)) }
    let config = ConfigurationAppIntent()
    SimpleEntry(date: .now, configuration: config, metricValue: 425, organizationName: "Acme Inc", chartData: placeholderData, lastUpdated: Date())
}

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue:  Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}
