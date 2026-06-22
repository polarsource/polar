import WidgetKit
import SwiftUI
import Charts

struct Provider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> SimpleEntry {
        let placeholderData = generatePlaceholderData(days: 30)
        let combinedMetrics = CombinedMetrics(
            revenueValue: 425,
            revenueChartData: placeholderData,
            ordersValue: 12,
            ordersChartData: generatePlaceholderData(days: 30, scale: 0.5),
            averageOrderValue: 35.42,
            averageOrderValueChartData: generatePlaceholderData(days: 30, scale: 0.3)
        )
        return SimpleEntry(date: Date(), configuration: ConfigurationAppIntent(), metricValue: 425, metricValueDouble: nil, organizationName: "Acme Inc", chartData: placeholderData, lastUpdated: Date(), isError: false, isUnauthorized: false, combinedMetrics: combinedMetrics)
    }

    func snapshot(for configuration: ConfigurationAppIntent, in context: Context) async -> SimpleEntry {
        let defaults = UserDefaults(suiteName: "group.com.polarsource.Polar")
        let orgName = defaults?.string(forKey: "widget_organization_name")
        let days = configuration.timeFrame.days
        
        if let (metricValue, metricValueDouble, chartData, _) = await fetchMetrics(days: days, metricType: configuration.metricType) {
            let combinedMetrics = await fetchAllMetrics(days: days)
            return SimpleEntry(date: Date(), configuration: configuration, metricValue: metricValue, metricValueDouble: metricValueDouble, organizationName: orgName, chartData: chartData, lastUpdated: Date(), isError: false, isUnauthorized: false, combinedMetrics: combinedMetrics)
        }
        
        let apiToken = defaults?.string(forKey: "widget_api_token")
        let organizationId = defaults?.string(forKey: "widget_organization_id")
        let isUnauthorized = await checkIfUnauthorized(apiToken: apiToken, organizationId: organizationId)
        
        let placeholderData = generatePlaceholderData(days: days)
        return SimpleEntry(date: Date(), configuration: configuration, metricValue: 425, metricValueDouble: nil, organizationName: orgName, chartData: placeholderData, lastUpdated: Date(), isError: true, isUnauthorized: isUnauthorized, combinedMetrics: nil)
    }
    
    func timeline(for configuration: ConfigurationAppIntent, in context: Context) async -> Timeline<SimpleEntry> {
        let currentDate = Date()
        let defaults = UserDefaults(suiteName: "group.com.polarsource.Polar")
        let orgName = defaults?.string(forKey: "widget_organization_name")
        let days = configuration.timeFrame.days

        let result = await fetchMetrics(days: days, metricType: configuration.metricType)
        let combinedMetrics = await fetchAllMetrics(days: days)
        
        let entry: SimpleEntry
        if let (metricValue, metricValueDouble, chartData, _) = result {
            entry = SimpleEntry(date: currentDate, configuration: configuration, metricValue: metricValue, metricValueDouble: metricValueDouble, organizationName: orgName, chartData: chartData, lastUpdated: currentDate, isError: false, isUnauthorized: false, combinedMetrics: combinedMetrics)
        } else {
            let apiToken = defaults?.string(forKey: "widget_api_token")
            let organizationId = defaults?.string(forKey: "widget_organization_id")
            let isUnauthorized = await checkIfUnauthorized(apiToken: apiToken, organizationId: organizationId)
            
            entry = SimpleEntry(date: currentDate, configuration: configuration, metricValue: 182, metricValueDouble: nil, organizationName: orgName, chartData: generatePlaceholderData(days: days), lastUpdated: currentDate, isError: true, isUnauthorized: isUnauthorized, combinedMetrics: nil)
        }
        
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 5, to: currentDate)!
        
        return Timeline(entries: [entry], policy: .after(nextUpdate))
    }
    
    func generatePlaceholderData(days: Int, scale: Double = 1.0) -> [RevenueData] {
        return (1...days).map { day in
            let dayDouble = Double(day)
            let baseGrowth = dayDouble * 8.0 * scale
            let wave1 = sin(dayDouble * 0.3) * 40.0 * scale
            let wave2 = cos(dayDouble * 0.15) * 25.0 * scale
            let amount = max(10.0, baseGrowth + wave1 + wave2)
            return RevenueData(day: day, amount: amount)
        }
    }
    
    private func calculateAverageOrderValue(revenue: Int, orders: Int) -> Double {
        guard orders > 0 else { return 0 }
        return Double(revenue) / Double(orders) / 100.0
    }
    
    private func checkIfUnauthorized(apiToken: String?, organizationId: String?) async -> Bool {
        guard let apiToken = apiToken,
              let organizationId = organizationId else {
            return false
        }
        
        let endDate = Date()
        guard let startDate = Calendar.current.date(byAdding: .day, value: -7, to: endDate) else {
            return false
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
            return false
        }
        
        var request = URLRequest(url: url)
        request.setValue("Bearer \(apiToken)", forHTTPHeaderField: "Authorization")
        
        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            
            if let httpResponse = response as? HTTPURLResponse {
                return httpResponse.statusCode == 401
            }
            
            return false
        } catch {
            return false
        }
    }
    
    private func fetchMetrics(days: Int, metricType: MetricType) async -> (Int, Double?, [RevenueData], Int?)? {
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
            let (data, response) = try await URLSession.shared.data(for: request)
            
            var statusCode: Int?
            if let httpResponse = response as? HTTPURLResponse {
                statusCode = httpResponse.statusCode
                
                if httpResponse.statusCode == 401 {
                    return nil
                }
            }
            
            let decodedResponse = try JSONDecoder().decode(MetricsResponse.self, from: data)
            
            let metricValue: Int
            let metricValueDouble: Double?
            switch metricType {
            case .revenue:
                let revenueCents = decodedResponse.totals.revenue ?? 0
                metricValue = Int(Double(revenueCents) / 100.0)
                metricValueDouble = nil
            case .orders:
                metricValue = decodedResponse.totals.orders ?? 0
                metricValueDouble = nil
            case .averageOrderValue:
                let aov = calculateAverageOrderValue(
                    revenue: decodedResponse.totals.revenue ?? 0,
                    orders: decodedResponse.totals.orders ?? 0
                )
                metricValue = Int(aov)
                metricValueDouble = aov
            }
            
            var cumulativeValue: Double = 0
            let chartData = decodedResponse.periods.enumerated().map { index, period -> RevenueData in
                let periodValue: Double
                switch metricType {
                case .revenue:
                    periodValue = Double(period.revenue ?? 0) / 100.0
                case .orders:
                    periodValue = Double(period.orders ?? 0)
                case .averageOrderValue:
                    let periodRevenue = period.revenue ?? 0
                    let periodOrders = period.orders ?? 0
                    periodValue = calculateAverageOrderValue(revenue: periodRevenue, orders: periodOrders)
                }
                cumulativeValue += periodValue
                
                return RevenueData(day: index + 1, amount: cumulativeValue)
            }
            
            return (metricValue, metricValueDouble, chartData, statusCode)
            
        } catch {
            return nil
        }
    }
    
    private func fetchAllMetrics(days: Int) async -> CombinedMetrics? {
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
            
            let revenueValue = Int(Double(decodedResponse.totals.revenue ?? 0) / 100.0)
            let ordersValue = decodedResponse.totals.orders ?? 0
            let averageOrderValue = calculateAverageOrderValue(
                revenue: decodedResponse.totals.revenue ?? 0,
                orders: decodedResponse.totals.orders ?? 0
            )
            
            var cumulativeRevenue: Double = 0
            let revenueChartData = decodedResponse.periods.enumerated().map { index, period -> RevenueData in
                let periodValue = Double(period.revenue ?? 0) / 100.0
                cumulativeRevenue += periodValue
                return RevenueData(day: index + 1, amount: cumulativeRevenue)
            }
            
            var cumulativeOrders: Double = 0
            let ordersChartData = decodedResponse.periods.enumerated().map { index, period -> RevenueData in
                let periodValue = Double(period.orders ?? 0)
                cumulativeOrders += periodValue
                return RevenueData(day: index + 1, amount: cumulativeOrders)
            }
            
            var cumulativeAOV: Double = 0
            let aovChartData = decodedResponse.periods.enumerated().map { index, period -> RevenueData in
                let periodRevenue = period.revenue ?? 0
                let periodOrders = period.orders ?? 0
                let periodAOV = calculateAverageOrderValue(revenue: periodRevenue, orders: periodOrders)
                cumulativeAOV += periodAOV
                return RevenueData(day: index + 1, amount: cumulativeAOV)
            }
            
            return CombinedMetrics(
                revenueValue: revenueValue,
                revenueChartData: revenueChartData,
                ordersValue: ordersValue,
                ordersChartData: ordersChartData,
                averageOrderValue: averageOrderValue,
                averageOrderValueChartData: aovChartData
            )
            
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

struct CombinedMetrics {
    let revenueValue: Int
    let revenueChartData: [RevenueData]
    let ordersValue: Int
    let ordersChartData: [RevenueData]
    let averageOrderValue: Double
    let averageOrderValueChartData: [RevenueData]
}

struct SimpleEntry: TimelineEntry {
    let date: Date
    let configuration: ConfigurationAppIntent
    let metricValue: Int
    let metricValueDouble: Double?
    let organizationName: String?
    let chartData: [RevenueData]
    let lastUpdated: Date
    let isError: Bool
    let isUnauthorized: Bool
    let combinedMetrics: CombinedMetrics?
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

func formatAverageOrderValue(_ value: Double) -> String {
    if value >= 1000 {
        return String(format: "$%.1fk", value / 1000.0)
    } else if value >= 100 {
        return String(format: "$%.0f", value)
    } else {
        return String(format: "$%.2f", value)
    }
}

struct widgetEntryView : View {
    var entry: Provider.Entry
    @Environment(\.widgetFamily) var family
    @Environment(\.colorScheme) var colorScheme

    var body: some View {
        if family == .systemLarge && entry.combinedMetrics != nil {
            largeWidgetView
        } else {
            standardWidgetView
        }
    }
    
    private var largeWidgetView: some View {
        let combinedMetrics = entry.combinedMetrics!
        let timeFrameText = entry.configuration.timeFrame.rawValue
        
        let primaryTextColor: Color = colorScheme == .dark ? .white : .black
        let secondaryTextColor: Color = colorScheme == .dark ? .white.opacity(0.6) : .black.opacity(0.6)
        let logoImageName = colorScheme == .dark ? "PolarLogoWhite" : "PolarLogoBlack"
        
        return ZStack {
            if !entry.isError {
                VStack(alignment: .leading, spacing: 12) {
                    HStack(spacing: 10) {
                        Image(logoImageName)
                            .resizable()
                            .scaledToFit()
                            .frame(width: 24, height: 24)
                        
                        Text("Metrics | \(timeFrameText)")
                            .font(.subheadline)
                            .fontWeight(.medium)
                            .foregroundStyle(primaryTextColor)
                        
                        Spacer()
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 10)
                    .padding(.bottom, 24)
                    
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text("Revenue")
                                .font(.subheadline)
                                .fontWeight(.semibold)
                                .foregroundStyle(primaryTextColor)
                            
                            Spacer()
                            
                            Text(formatCompactValue(combinedMetrics.revenueValue))
                                .font(.title2)
                                .fontWeight(.bold)
                                .foregroundStyle(primaryTextColor)
                        }
                        .padding(.horizontal, 16)
                        
                        Chart(combinedMetrics.revenueChartData) { data in
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
                            .lineStyle(StrokeStyle(lineWidth: 3))
                            
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
                        .chartXScale(domain: 1...combinedMetrics.revenueChartData.count)
                        .chartYScale(domain: 0...(combinedMetrics.revenueChartData.map { $0.amount }.max() ?? 240) * 1.2)
                        .chartXAxis(.hidden)
                        .chartYAxis(.hidden)
                        .frame(height: 30)
                        .padding(.horizontal, 16)
                    }
                    
                    Divider()
                        .padding(.horizontal, 16)
                    
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text("Orders")
                                .font(.subheadline)
                                .fontWeight(.semibold)
                                .foregroundStyle(primaryTextColor)
                            
                            Spacer()
                            
                            Text("\(combinedMetrics.ordersValue)")
                                .font(.title2)
                                .fontWeight(.bold)
                                .foregroundStyle(primaryTextColor)
                        }
                        .padding(.horizontal, 16)
                        
                        Chart(combinedMetrics.ordersChartData) { data in
                            LineMark(
                                x: .value("Day", data.day),
                                y: .value("Orders", data.amount)
                            )
                            .interpolationMethod(.monotone)
                            .foregroundStyle(
                                LinearGradient(
                                    colors: [Color(hex: "005FFF"), Color(hex: "005FFF").opacity(0.7)],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .lineStyle(StrokeStyle(lineWidth: 3))
                            
                            AreaMark(
                                x: .value("Day", data.day),
                                y: .value("Orders", data.amount)
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
                        .chartXScale(domain: 1...combinedMetrics.ordersChartData.count)
                        .chartYScale(domain: 0...(combinedMetrics.ordersChartData.map { $0.amount }.max() ?? 240) * 1.2)
                        .chartXAxis(.hidden)
                        .chartYAxis(.hidden)
                        .frame(height: 30)
                        .padding(.horizontal, 16)
                    }
                    
                    Divider()
                        .padding(.horizontal, 16)
                    
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text("Avg Order Value")
                                .font(.subheadline)
                                .fontWeight(.semibold)
                                .foregroundStyle(primaryTextColor)
                            
                            Spacer()
                            
                            Text(formatAverageOrderValue(combinedMetrics.averageOrderValue))
                                .font(.title2)
                                .fontWeight(.bold)
                                .foregroundStyle(primaryTextColor)
                        }
                        .padding(.horizontal, 16)
                        
                        Chart(combinedMetrics.averageOrderValueChartData) { data in
                            LineMark(
                                x: .value("Day", data.day),
                                y: .value("AOV", data.amount)
                            )
                            .interpolationMethod(.monotone)
                            .foregroundStyle(
                                LinearGradient(
                                    colors: [Color(hex: "005FFF"), Color(hex: "005FFF").opacity(0.7)],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .lineStyle(StrokeStyle(lineWidth: 3))
                            
                            AreaMark(
                                x: .value("Day", data.day),
                                y: .value("AOV", data.amount)
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
                        .chartXScale(domain: 1...combinedMetrics.averageOrderValueChartData.count)
                        .chartYScale(domain: 0...(combinedMetrics.averageOrderValueChartData.map { $0.amount }.max() ?? 240) * 1.2)
                        .chartXAxis(.hidden)
                        .chartYAxis(.hidden)
                        .frame(height: 30)
                        .padding(.horizontal, 16)
                    }
                    
                    Spacer()
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }

            if entry.isError {
                Text(entry.isUnauthorized ? "Log in to see your data" : "Error fetching data")
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundStyle(primaryTextColor)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 16)
            }
        }
        .unredacted()
    }
    
    private var standardWidgetView: some View {
        let maxValue = entry.chartData.map { $0.amount }.max() ?? 240
        let yAxisMax = maxValue * 1.2
        let timeFrameText = entry.configuration.timeFrame.rawValue
        let metricType = entry.configuration.metricType
        let metricLabel = metricType.rawValue
        
        let formattedValue: String
        switch metricType {
        case .revenue:
            formattedValue = formatCompactValue(entry.metricValue)
        case .orders:
            formattedValue = "\(entry.metricValue)"
        case .averageOrderValue:
            let aovValue = entry.metricValueDouble ?? Double(entry.metricValue)
            formattedValue = formatAverageOrderValue(aovValue)
        }
        
        let primaryTextColor: Color = colorScheme == .dark ? .white : .black
        let secondaryTextColor: Color = colorScheme == .dark ? .white.opacity(0.6) : .black.opacity(0.6)
        let logoImageName = colorScheme == .dark ? "PolarLogoWhite" : "PolarLogoBlack"
        
        let chartColor = "005FFF"
      
        return ZStack {
            if !entry.isError {
                VStack(alignment: .leading, spacing: family == .systemSmall ? 4 : 2) {
                    if family == .systemSmall {
                        let shortTimeFrame = timeFrameText.replacingOccurrences(of: " days", with: "d")

                        let shouldShowLabel = formattedValue.count <= 3
                        
                        HStack(spacing: 4) {
                            Image(logoImageName)
                                .resizable()
                                .scaledToFit()
                                .frame(width: 16, height: 16)

                            if shouldShowLabel {
                                Text("\(metricLabel)")
                                    .font(.caption2)
                                    .fontWeight(.medium)
                                    .foregroundStyle(primaryTextColor)
                                    .lineLimit(1)
                                    .fixedSize(horizontal: true, vertical: false)
                            }
                          
                            Spacer(minLength: 2)
                            
                            Text(formattedValue)
                                .font(.headline)
                                .fontWeight(.bold)
                                .foregroundStyle(primaryTextColor)
                                .lineLimit(1)
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
                                colors: [Color(hex: chartColor), Color(hex: chartColor).opacity(0.7)],
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
                                colors: [Color(hex: chartColor).opacity(0.3), Color(hex: chartColor).opacity(0.05)],
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
            }

            if entry.isError {
                Text(entry.isUnauthorized ? "Log in to see your analytics" : "Error fetching analytics")
                    .font(family == .systemSmall ? .caption : .subheadline)
                    .fontWeight(.semibold)
                    .foregroundStyle(primaryTextColor)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 16)
            }
        }
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
    let placeholderData = (1...30).map { i in RevenueData(day: i, amount: Double(i) * 10.0) }
    let ordersData = (1...30).map { i in RevenueData(day: i, amount: Double(i) * 0.5) }
    let aovData = (1...30).map { i in RevenueData(day: i, amount: Double(i) * 0.3) }
    let combinedMetrics = CombinedMetrics(
        revenueValue: 425,
        revenueChartData: placeholderData,
        ordersValue: 12,
        ordersChartData: ordersData,
        averageOrderValue: 35.42,
        averageOrderValueChartData: aovData
    )
    let config = ConfigurationAppIntent()
    SimpleEntry(date: .now, configuration: config, metricValue: 425, metricValueDouble: nil, organizationName: "Acme Inc", chartData: placeholderData, lastUpdated: Date(), isError: false, isUnauthorized: false, combinedMetrics: combinedMetrics)
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
