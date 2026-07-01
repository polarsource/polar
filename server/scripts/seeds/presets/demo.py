"""Demo presets for native Basic — the multi-org set `build_demo` seeds.

Reproduces the full `dev seed` demo: the same 8 orgs (the `polar` org is layered
on separately by `build_demo` via `seed_polar_self`), with components distributed
per-org the way `create_seed_data` distributes its data.
"""

from __future__ import annotations

from typing import Any

DEMO_ORGS: list[dict[str, Any]] = [
    {
        "slug": "acme-corp",
        "components": {
            "products": "mix",
            "customers": True,
            "orders": True,
            "benefits": True,
            "discounts": True,
            "checkout_links": True,
            "disputes": True,
            "support_cases": True,
            "cost_insights": True,
        },
    },
    {
        "slug": "widget-industries",
        "components": {
            "products": "subscriptions",
            "customers": True,
            "org_review": "denied",
        },
    },
    {
        "slug": "melted-sql",
        "components": {"products": "mix", "customers": True, "orders": True},
    },
    {
        "slug": "coldmail",
        "components": {
            "products": "metered",
            "customers": True,
            "cost_insights": True,
        },
    },
    {
        "slug": "example-news-inc",
        "components": {"products": "one_time", "customers": True, "orders": True},
    },
    {
        "slug": "admin-org",
        "components": {"products": "mix", "customers": True, "orders": True},
    },
    {
        "slug": "seatbased-members-corp",
        "components": {"products": "seats", "customers": True},
    },
    {
        "slug": "seatbased-only-corp",
        "components": {"products": "seats", "customers": True},
    },
]
