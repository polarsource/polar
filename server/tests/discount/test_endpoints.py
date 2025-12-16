import pytest
from httpx import AsyncClient

from polar.models import Organization, UserOrganization


@pytest.mark.asyncio
class TestCreateDiscount:
    async def test_anonymous(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.post(
            "/v1/discounts/",
            json={
                "name": "Discount",
                "type": "percentage",
                "code": "DISCOUNT",
                "duration": "once",
                "basis_points": 1000,
                "organization_id": str(organization.id),
            },
        )

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_missing_type(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            "/v1/discounts/",
            json={
                "name": "Discount",
                "code": "DISCOUNT",
                "duration": "once",
                "basis_points": 1000,
                "organization_id": str(organization.id),
            },
        )

        assert response.status_code == 422

    @pytest.mark.auth
    async def test_missing_duration(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            "/v1/discounts/",
            json={
                "name": "Discount",
                "type": "percentage",
                "code": "DISCOUNT",
                "basis_points": 1000,
                "organization_id": str(organization.id),
            },
        )

        assert response.status_code == 422

    @pytest.mark.auth
    async def test_valid(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            "/v1/discounts/",
            json={
                "name": "Discount",
                "type": "percentage",
                "code": "DISCOUNT",
                "duration": "once",
                "basis_points": 1000,
                "organization_id": str(organization.id),
            },
        )

        assert response.status_code == 201
