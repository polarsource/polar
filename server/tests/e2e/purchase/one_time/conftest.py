"""Fixtures for one-time purchase E2E tests."""

import pytest_asyncio

from polar.models import Organization, Product
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_product


@pytest_asyncio.fixture
async def one_time_product(
    save_fixture: SaveFixture, organization: Organization
) -> Product:
    return await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=None,
        name="E2E Widget",
        prices=[(2500, "usd")],
    )
