import pytest

from polar.models import Organization
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_verified_organization_email


@pytest.fixture(autouse=True)
async def verified_support_email(
    save_fixture: SaveFixture, organization: Organization
) -> None:
    await create_verified_organization_email(
        save_fixture, organization, "support@example.com"
    )
