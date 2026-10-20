import pytest

from polar.catalog.repository import CatalogProductRepository
from polar.catalog.service import catalog as catalog_service
from polar.enums import SubscriptionRecurringInterval
from polar.kit.utils import utc_now
from polar.models import Organization
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_product


@pytest.mark.anyio
class TestGetProduct:
    async def test_excludes_deleted_product(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            external_id="pro",
        )
        catalog = await catalog_service.get_or_create_live(session, organization)
        assert catalog is not None
        repository = CatalogProductRepository.from_session(session)
        assert await repository.get_product(catalog.id, "pro") == product

        product.deleted_at = utc_now()
        await save_fixture(product)

        assert await repository.get_product(catalog.id, "pro") is None
