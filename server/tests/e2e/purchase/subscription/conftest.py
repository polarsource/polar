"""Fixtures for subscription purchase E2E tests."""

import pytest_asyncio

from polar.enums import SubscriptionRecurringInterval
from polar.models import Organization, Product
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_product


@pytest_asyncio.fixture
async def monthly_product(
    save_fixture: SaveFixture, organization: Organization
) -> Product:
    return await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=SubscriptionRecurringInterval.month,
        name="E2E Monthly Plan",
        prices=[(1500, "usd")],  # $15/month
    )
