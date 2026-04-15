import pytest
from httpx import AsyncClient

from polar.models import (
    Benefit,
    Customer,
    Organization,
    Subscription,
    UserOrganization,
)
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_benefit, create_benefit_grant


@pytest.mark.asyncio
class TestListBenefitGrants:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get("/v1/benefit-grants/")
        assert response.status_code == 401

    @pytest.mark.auth
    async def test_active_benefit_is_not_deleted(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        benefit_organization: Benefit,
        customer: Customer,
        subscription: Subscription,
    ) -> None:
        await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            granted=True,
            subscription=subscription,
        )

        response = await client.get(
            "/v1/benefit-grants/",
            params={"organization_id": str(organization.id)},
        )

        assert response.status_code == 200
        json = response.json()
        assert len(json["items"]) == 1
        assert json["items"][0]["benefit"]["is_deleted"] is False

    @pytest.mark.auth
    async def test_deleted_benefit_is_deleted(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        customer: Customer,
        subscription: Subscription,
    ) -> None:
        benefit = await create_benefit(save_fixture, organization=organization)
        await create_benefit_grant(
            save_fixture,
            customer,
            benefit,
            granted=True,
            subscription=subscription,
        )
        benefit.set_deleted_at()
        await save_fixture(benefit)

        response = await client.get(
            "/v1/benefit-grants/",
            params={"organization_id": str(organization.id)},
        )

        assert response.status_code == 200
        json = response.json()
        assert len(json["items"]) == 1
        assert json["items"][0]["benefit"]["is_deleted"] is True
