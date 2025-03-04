from .components import navigation

NAVIGATION = [
    navigation.NavigationItem(
        "Organizations", "organizations:list", active_route_name_prefix="organizations:"
    ),
]
