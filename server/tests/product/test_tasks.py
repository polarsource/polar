import uuid

import pytest
from pytest_mock import MockerFixture

from polar.kit.db.postgres import AsyncSession
from polar.models import Organization, OrganizationRiskSignal, Product
from polar.organization_review.repository import OrganizationRiskSignalRepository
from polar.product.tasks import ProductDoesNotExist, check_name
from polar.redis import Redis
from polar.worker import RedisMiddleware
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_product


@pytest.mark.anyio
class TestCheckName:
    async def test_not_existing_product(self, session: AsyncSession) -> None:
        session.expunge_all()

        with pytest.raises(ProductDoesNotExist):
            await check_name(uuid.uuid4())

    async def test_flagged_name(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        mocker.patch.object(RedisMiddleware, "get", return_value=redis)
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=None,
            name="Casino Night",
        )
        session.expunge_all()

        await check_name(product.id)

        repository = OrganizationRiskSignalRepository.from_session(session)
        [signal] = await repository.list_by_organization(organization.id)
        assert signal.type == OrganizationRiskSignal.Type.FLAGGED_PRODUCT_NAME

    async def test_model_failure_records_nothing(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        redis: Redis,
        organization: Organization,
        product: Product,
    ) -> None:
        mocker.patch.object(RedisMiddleware, "get", return_value=redis)
        mocker.patch("polar.product.tasks.judge_product_name", return_value=None)
        session.expunge_all()

        await check_name(product.id)

        repository = OrganizationRiskSignalRepository.from_session(session)
        assert await repository.list_by_organization(organization.id) == []
