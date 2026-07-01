"""Registry of all seed components.

Add a new entity by creating its module and appending its `component` here. The
runner and the `describe` output (which drives the `dev seed2` menu) pick it up
automatically — nothing else to wire.
"""

from __future__ import annotations

from scripts.seeds.base import SeedComponent
from scripts.seeds.components import (
    access_tokens,
    benefits,
    checkout_links,
    cost_insights,
    customers,
    discounts,
    disputes,
    orders,
    org_review,
    products,
    support_cases,
    webhooks,
)

COMPONENTS: list[SeedComponent] = [
    products.component,
    customers.component,
    orders.component,
    benefits.component,
    discounts.component,
    checkout_links.component,
    disputes.component,
    support_cases.component,
    cost_insights.component,
    access_tokens.component,
    webhooks.component,
    org_review.component,
]

COMPONENTS_BY_KEY: dict[str, SeedComponent] = {
    component.key: component for component in COMPONENTS
}
