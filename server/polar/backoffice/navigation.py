from .components import navigation

NAVIGATION = [
    navigation.NavigationItem("Users", "users:list", active_route_name_prefix="users:"),
    navigation.NavigationItem(
        "Organizations", "organizations:list", active_route_name_prefix="organizations:"
    ),
    navigation.NavigationItem(
        "Customers", "customers:list", active_route_name_prefix="customers:"
    ),
    navigation.NavigationItem(
        "Benefits", "benefits:list", active_route_name_prefix="benefits:"
    ),
    navigation.NavigationItem(
        "Products", "products:list", active_route_name_prefix="products:"
    ),
    navigation.NavigationItem(
        "Subscriptions", "subscriptions:list", active_route_name_prefix="subscriptions:"
    ),
    navigation.NavigationItem(
        "Orders", "orders:list", active_route_name_prefix="orders:"
    ),
    navigation.NavigationItem(
        "External Events",
        "external_events:list",
        active_route_name_prefix="external_events:",
    ),
    navigation.NavigationItem("Tasks", "tasks:list", active_route_name_prefix="tasks:"),
    navigation.NavigationItem(
        "Pledges", "pledges:list", active_route_name_prefix="pledges:"
    ),
    navigation.NavigationItem(
        "Webhooks", "webhooks:list", active_route_name_prefix="webhooks:"
    ),
]
