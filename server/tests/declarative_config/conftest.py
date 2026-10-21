import pytest

from polar.models import Organization
from tests.fixtures.database import SaveFixture


@pytest.fixture
async def config_as_code_enabled(
    save_fixture: SaveFixture, organization: Organization
) -> None:
    organization.feature_settings = {
        **organization.feature_settings,
        "config_as_code_enabled": True,
    }
    await save_fixture(organization)
