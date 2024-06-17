import pytest
from httpx import AsyncClient

from polar.models import Benefit, Subscription, User
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_benefit_grant


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
class TestListBenefits:
    @pytest.mark.auth
    async def test_user(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        subscription: Subscription,
        benefit_organization: Benefit,
        benefit_organization_second: Benefit,
        user: User,
    ) -> None:
        await create_benefit_grant(
            save_fixture,
            user,
            benefit_organization,
            granted=True,
            subscription=subscription,
        )

        await create_benefit_grant(
            save_fixture,
            user,
            benefit_organization_second,
            granted=False,
            subscription=subscription,
        )

        response = await client.get("/api/v1/users/benefits/")

        assert response.status_code == 200
        json = response.json()

        assert json["pagination"]["total_count"] == 1
