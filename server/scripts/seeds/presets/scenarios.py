"""Named dev scenarios — outcome-oriented presets over the components.

A scenario is a small components spec (the runner auto-resolves dependencies, so
specs only need to name the interesting parts). `components: None` means "every
component, default variants". This module is plain data — no heavy imports — so
listing scenarios is instant.
"""

from __future__ import annotations

from typing import Any

SCENARIOS: list[dict[str, Any]] = [
    {
        "key": "billing",
        "label": "Billing & subscriptions",
        "hint": "products + customers + orders/subscriptions",
        "components": {"products": "subscriptions", "customers": True, "orders": True},
    },
    {
        "key": "metered",
        "label": "Usage / metered billing",
        "hint": "metered product + usage events",
        "components": {"products": "metered", "customers": True, "cost_insights": True},
    },
    {
        "key": "seats",
        "label": "Seats / team plans",
        "hint": "seat-based product + seat allocation",
        "components": {"products": "seats", "customers": True},
    },
    {
        "key": "benefits",
        "label": "Benefits & entitlements",
        "hint": "products + benefits + a subscribed customer",
        "components": {
            "products": "mix",
            "customers": True,
            "orders": True,
            "benefits": True,
            "checkout_links": True,
        },
    },
    {
        "key": "backoffice",
        "label": "Backoffice (disputes & review)",
        "hint": "disputes + support cases + a denied org",
        "components": {
            "products": "mix",
            "customers": True,
            "disputes": True,
            "support_cases": True,
            "org_review": "denied",
        },
    },
    {
        "key": "empty",
        "label": "Empty org",
        "hint": "just an org + owner",
        "components": {},
    },
    {
        "key": "everything",
        "label": "Everything",
        "hint": "the kitchen sink",
        "components": None,
    },
]

SCENARIOS_BY_KEY = {scenario["key"]: scenario for scenario in SCENARIOS}


def list_scenarios() -> list[dict[str, str]]:
    return [
        {"key": s["key"], "label": s["label"], "hint": s["hint"]} for s in SCENARIOS
    ]
