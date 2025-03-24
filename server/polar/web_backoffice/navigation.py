from .components import navigation

NAVIGATION = [
    navigation.NavigationItem(
        "Organizations", "organizations:list", active_route_name_prefix="organizations:"
    ),
    navigation.NavigationItem(
        "External Events",
        "external_events:list",
        active_route_name_prefix="external_events:",
    ),
    navigation.NavigationItem("Tasks", "tasks:list", active_route_name_prefix="tasks:"),
]
