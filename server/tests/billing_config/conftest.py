import pytest_asyncio

from polar.models import Organization
from tests.fixtures.database import SaveFixture


@pytest_asyncio.fixture
async def billing_config_enabled(
    save_fixture: SaveFixture, organization: Organization
) -> None:
    organization.feature_settings = {
        **organization.feature_settings,
        "billing_config_enabled": True,
    }
    await save_fixture(organization)
