from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from httpx import AsyncClient
from pytest_mock import MockerFixture

from polar.integrations.stripe.service import StripeService
from polar.models import Organization, UserOrganization


@pytest.fixture(autouse=True)
def stripe_service_mock(mocker: MockerFixture) -> MagicMock:
    mock = MagicMock(spec=StripeService)
    mocker.patch("polar.discount.service.stripe_service", new=mock)
    mock.create_coupon.return_value = SimpleNamespace(id="COUPON_ID")
    return mock


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
