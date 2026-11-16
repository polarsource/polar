import pytest

from polar.enums import SubscriptionRecurringInterval
from polar.models import Organization, Product
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_product


@pytest.fixture
async def old_pro(save_fixture: SaveFixture, organization: Organization) -> Product:
    organization.feature_settings = {"config_as_code_enabled": True}
    await save_fixture(organization)
    return await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=SubscriptionRecurringInterval.month,
        name="Pro",
        external_id="pro",
        prices=[(2000, "usd")],
        is_current=False,
    )


@pytest.fixture
async def new_pro(save_fixture: SaveFixture, organization: Organization) -> Product:
    return await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=SubscriptionRecurringInterval.month,
        name="Pro",
        external_id="pro",
        prices=[(2500, "usd")],
    )
