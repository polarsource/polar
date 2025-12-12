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

struct ConfigurationAppIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource { "Revenue Widget" }
    static var description: IntentDescription { "Displays your organization's revenue over time." }
    
    @Parameter(title: "Time Frame", default: .thirtyDays)
    var timeFrame: TimeFrame
}
