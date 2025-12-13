import WidgetKit
import AppIntents

enum TimeFrame: String, AppEnum {
    case sevenDays = "7 days"
    case thirtyDays = "30 days"
    case ninetyDays = "90 days"
    
    static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Time Frame")
    static var caseDisplayRepresentations: [TimeFrame: DisplayRepresentation] = [
        .sevenDays: "Last 7 days",
        .thirtyDays: "Last 30 days",
        .ninetyDays: "Last 90 days"
    ]
    
    var days: Int {
        switch self {
        case .sevenDays: return 7
        case .thirtyDays: return 30
        case .ninetyDays: return 90
        }
    }
}

enum MetricType: String, AppEnum {
    case revenue = "Revenue"
    case orders = "Orders"
    case averageOrderValue = "AOV"
    
    static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Metric")
    static var caseDisplayRepresentations: [MetricType: DisplayRepresentation] = [
        .revenue: "Revenue",
        .orders: "Orders",
        .averageOrderValue: "Average Order Value"
    ]
}

struct ConfigurationAppIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource { "Metrics Widget" }
    static var description: IntentDescription { "Displays your organization's revenue or orders over time." }
    
    @Parameter(title: "Metric", default: .revenue)
    var metricType: MetricType
    
    @Parameter(title: "Time Frame", default: .thirtyDays)
    var timeFrame: TimeFrame
}
