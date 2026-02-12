from collections.abc import AsyncGenerator, Sequence
from dataclasses import dataclass
from typing import Any
from unittest.mock import patch

import pytest
import pytest_asyncio

from polar.config import settings
from polar.event.system import SystemEvent
from polar.integrations.tinybird.client import TinybirdClient
from polar.integrations.tinybird.service import DATASOURCE_EVENTS, _event_to_tinybird
from polar.models import Customer, Event, Order, Organization, Product, Subscription
from polar.models.event import EventSource
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_event
from tests.fixtures.tinybird import tinybird_available


async def create_events_for_fixtures(
    save_fixture: SaveFixture,
    organization: Organization,
    customer: Customer,
    products: dict[str, Product],
    subscriptions: dict[str, Subscription],
    orders: dict[str, Order],
) -> list[Event]:
    """Create Events corresponding to orders/subscriptions for Tinybird compatibility."""
    events: list[Event] = []

    for sub in subscriptions.values():
        if sub.started_at is None:
            continue
        product = next((p for p in products.values() if p.id == sub.product_id), None)
        if product is None:
            continue

        metadata: dict[str, Any] = {
            "subscription_id": str(sub.id),
            "product_id": str(product.id),
            "customer_id": str(customer.id),
            "started_at": sub.started_at.isoformat(),
            "recurring_interval": (
                product.recurring_interval.value if product.recurring_interval else None
            ),
            "recurring_interval_count": 1,
        }

        ev = await create_event(
            save_fixture,
            organization=organization,
            customer=customer,
            source=EventSource.system,
            name=SystemEvent.subscription_created.value,
            timestamp=sub.started_at,
            metadata=metadata,
        )
        events.append(ev)

        if sub.canceled_at and sub.ends_at:
            cancel_metadata: dict[str, Any] = {
                "subscription_id": str(sub.id),
                "canceled_at": sub.canceled_at.isoformat(),
                "ends_at": sub.ends_at.isoformat(),
            }
            if sub.customer_cancellation_reason:
                cancel_metadata["customer_cancellation_reason"] = (
                    sub.customer_cancellation_reason.value
                )
            ev = await create_event(
                save_fixture,
                organization=organization,
                customer=customer,
                source=EventSource.system,
                name=SystemEvent.subscription_canceled.value,
                timestamp=sub.canceled_at,
                metadata=cancel_metadata,
            )
            events.append(ev)

    for order in orders.values():
        product = next((p for p in products.values() if p.id == order.product_id), None)
        metadata = {
            "order_id": str(order.id),
            "product_id": str(order.product_id),
            "amount": order.net_amount,
            "currency": "usd",
            "presentment_amount": order.net_amount,
            "presentment_currency": "usd",
            "tax_amount": order.tax_amount,
            "fee": 0,
        }
        if order.subscription_id:
            metadata["subscription_id"] = str(order.subscription_id)
        if product is not None:
            metadata["billing_type"] = product.billing_type.value

        ev = await create_event(
            save_fixture,
            organization=organization,
            customer=customer,
            source=EventSource.system,
            name=SystemEvent.balance_order.value,
            timestamp=order.created_at,
            metadata=metadata,
        )
        events.append(ev)

    return events


@dataclass
class TinybirdTestHelper:
    """Helper for tests that need to ingest custom events to Tinybird."""

    backend: str
    tinybird_client: TinybirdClient | None
    save_fixture: SaveFixture
    organization: Organization

    @property
    def is_tinybird(self) -> bool:
        return self.backend == "tinybird"

    async def ingest_events(self, events: Sequence[Event]) -> None:
        """Ingest events to Tinybird if running in tinybird mode."""
        if self.is_tinybird and self.tinybird_client is not None:
            tinybird_events_data = [_event_to_tinybird(e) for e in events]
            await self.tinybird_client.ingest(
                DATASOURCE_EVENTS, tinybird_events_data, wait=True
            )

    async def ingest_fixtures(
        self,
        customer: Customer,
        products: dict[str, Product],
        subscriptions: dict[str, Subscription],
        orders: dict[str, Order],
    ) -> None:
        """Create and ingest events for custom fixtures."""
        if not self.is_tinybird:
            return
        events = await create_events_for_fixtures(
            self.save_fixture,
            self.organization,
            customer,
            products,
            subscriptions,
            orders,
        )
        await self.ingest_events(events)


@pytest_asyncio.fixture
async def metrics_events(
    save_fixture: SaveFixture,
    organization: Organization,
    customer: Customer,
    fixtures: tuple[dict[str, Product], dict[str, Subscription], dict[str, Order]],
) -> list[Event]:
    """Create Events corresponding to the test fixtures for Tinybird compatibility."""
    products, subscriptions, orders = fixtures
    return await create_events_for_fixtures(
        save_fixture, organization, customer, products, subscriptions, orders
    )


@pytest_asyncio.fixture(
    params=[
        pytest.param("postgres", id="postgres"),
        pytest.param(
            "tinybird",
            id="tinybird",
            marks=pytest.mark.skipif(
                not (tinybird_available() and False), reason="Tinybird tests disabled"
            ),
        ),
    ]
)
async def metrics_backend(
    request: pytest.FixtureRequest,
    save_fixture: SaveFixture,
    organization: Organization,
    metrics_events: list[Event],
) -> AsyncGenerator[str, None]:
    """Parameterized fixture to run tests against both Postgres and Tinybird backends.

    Use this for tests that use the standard `fixtures` fixture.
    """
    backend: str = request.param

    if backend == "tinybird":
        tinybird_client = request.getfixturevalue("tinybird_client")

        tinybird_events_data = [_event_to_tinybird(e) for e in metrics_events]
        await tinybird_client.ingest(DATASOURCE_EVENTS, tinybird_events_data, wait=True)

        organization.feature_settings = {
            **organization.feature_settings,
            "tinybird_read": True,
            "tinybird_compare": False,
        }
        await save_fixture(organization)

        with patch.object(settings, "TINYBIRD_EVENTS_READ", True):
            yield backend
    else:
        yield backend


@pytest_asyncio.fixture(
    params=[
        pytest.param("postgres", id="postgres"),
        pytest.param(
            "tinybird",
            id="tinybird",
            marks=pytest.mark.skipif(
                not (tinybird_available() and False), reason="Tinybird tests disabled"
            ),
        ),
    ]
)
async def metrics_backend_helper(
    request: pytest.FixtureRequest,
    save_fixture: SaveFixture,
    organization: Organization,
) -> AsyncGenerator[TinybirdTestHelper, None]:
    """Parameterized fixture for tests with custom fixtures.

    Use this for tests that create their own fixtures instead of using `fixtures`.
    Call helper.ingest_fixtures() or helper.ingest_events() after creating test data.
    """
    backend: str = request.param

    if backend == "tinybird":
        tinybird_client = request.getfixturevalue("tinybird_client")

        organization.feature_settings = {
            **organization.feature_settings,
            "tinybird_read": True,
            "tinybird_compare": False,
        }
        await save_fixture(organization)

        helper = TinybirdTestHelper(
            backend=backend,
            tinybird_client=tinybird_client,
            save_fixture=save_fixture,
            organization=organization,
        )

        with patch.object(settings, "TINYBIRD_EVENTS_READ", True):
            yield helper
    else:
        yield TinybirdTestHelper(
            backend=backend,
            tinybird_client=None,
            save_fixture=save_fixture,
            organization=organization,
        )
