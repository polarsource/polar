import WidgetKit
import AppIntents

struct ConfigurationAppIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource { "Revenue Widget" }
    static var description: IntentDescription { "Displays your organization's 30-day revenue." }
}
