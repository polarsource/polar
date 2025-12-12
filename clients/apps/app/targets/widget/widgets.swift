import WidgetKit
import SwiftUI
import Charts

struct Provider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> SimpleEntry {
        let placeholderData = generatePlaceholderData(days: 30)
        return SimpleEntry(date: Date(), configuration: ConfigurationAppIntent(), revenue: 425, organizationName: "Acme Inc", chartData: placeholderData, lastUpdated: Date())
    }

    func snapshot(for configuration: ConfigurationAppIntent, in context: Context) async -> SimpleEntry {
        let defaults = UserDefaults(suiteName: "group.com.polarsource.Polar")
        let orgName = defaults?.string(forKey: "widget_organization_name")
        let days = configuration.timeFrame.days
        
        if let (revenue, chartData) = await fetchRevenue(days: days) {
            return SimpleEntry(date: Date(), configuration: configuration, revenue: revenue, organizationName: orgName, chartData: chartData, lastUpdated: Date())
        }
        let placeholderData = generatePlaceholderData(days: days)
        return SimpleEntry(date: Date(), configuration: configuration, revenue: 425, organizationName: orgName, chartData: placeholderData, lastUpdated: Date())
    }
    
    func timeline(for configuration: ConfigurationAppIntent, in context: Context) async -> Timeline<SimpleEntry> {
        let currentDate = Date()
        let defaults = UserDefaults(suiteName: "group.com.polarsource.Polar")
        let orgName = defaults?.string(forKey: "widget_organization_name")
        let days = configuration.timeFrame.days
        
        let (revenue, chartData) = await fetchRevenue(days: days) ?? (425, generatePlaceholderData(days: days))
        
        let entry = SimpleEntry(date: currentDate, configuration: configuration, revenue: revenue, organizationName: orgName, chartData: chartData, lastUpdated: currentDate)
        
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 5, to: currentDate)!
        
        return Timeline(entries: [entry], policy: .after(nextUpdate))
    }
    
    private func generatePlaceholderData(days: Int) -> [RevenueData] {
        return (1...days).map { day in
            RevenueData(day: day, amount: Double(day * 10))
        }
    }
    
    private func fetchRevenue(days: Int) async -> (Int, [RevenueData])? {
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
            
            let revenueCents = decodedResponse.totals.revenue ?? 0
            let revenueDollars = Int(Double(revenueCents) / 100.0)
            
            var cumulativeRevenue: Double = 0
            let chartData = decodedResponse.periods.enumerated().map { index, period -> RevenueData in
                let periodRevenueCents = Double(period.revenue ?? 0)
                cumulativeRevenue += periodRevenueCents
                let cumulativeDollars = cumulativeRevenue / 100.0
                
                return RevenueData(day: index + 1, amount: cumulativeDollars)
            }
            
            return (revenueDollars, chartData)
            
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
}

struct MetricsPeriod: Codable {
    let revenue: Int?
}

struct SimpleEntry: TimelineEntry {
    let date: Date
    let configuration: ConfigurationAppIntent
    let revenue: Int
    let organizationName: String?
    let chartData: [RevenueData]
    let lastUpdated: Date
}

struct RevenueData: Identifiable {
    let id = UUID()
    let day: Int
    let amount: Double
}

struct widgetEntryView : View {
    var entry: Provider.Entry
    @Environment(\.widgetFamily) var family

    var body: some View {
        let maxValue = entry.chartData.map { $0.amount }.max() ?? 240
        let yAxisMax = maxValue * 1.2
        let timeFrameText = entry.configuration.timeFrame.rawValue
      
        return VStack(alignment: .leading, spacing: family == .systemSmall ? 6 : 8) {
            HStack(spacing: 8) {
                Image("PolarLogoSmall")
                    .resizable()
                    .scaledToFit()
                    .frame(width: family == .systemSmall ? 20 : 20, height: family == .systemSmall ? 20 : 20)
                
                if let orgName = entry.organizationName {
                    Text("\(orgName) | \(timeFrameText)")
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .foregroundStyle(.white.opacity(0.9))
                        .lineLimit(1)
                        .truncationMode(.tail)
                } else {
                    Text("Revenue | \(timeFrameText)")
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .foregroundStyle(.white.opacity(0.9))
                }
                
                Spacer()
                
                Text("$\(entry.revenue)")
                    .font(family == .systemSmall ? .title3 : .title)
                    .fontWeight(.bold)
                    .foregroundStyle(.white)
            }
            .padding(.horizontal, family == .systemSmall ? 8 : 10)
            
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
            .padding(.horizontal, family == .systemSmall ? 8 : 10)
        }
        .padding(.vertical, family == .systemSmall ? 8 : 10)
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
                    LinearGradient(
                        colors: [Color(red: 0.1, green: 0.1, blue: 0.15), Color(red: 0.05, green: 0.05, blue: 0.1)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                }
        }
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

#Preview(as: .systemSmall) {
    widget()
} timeline: {
    let placeholderData = (1...30).map { i in RevenueData(day: i, amount: Double(i * 10)) }
    let config = ConfigurationAppIntent()
    SimpleEntry(date: .now, configuration: config, revenue: 425, organizationName: "Acme Inc", chartData: placeholderData, lastUpdated: Date())
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
