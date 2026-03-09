from typing import Any

import pytest
from httpx import AsyncClient

from polar.discount.repository import DiscountRepository
from polar.models import Organization, UserOrganization
from polar.models.discount import (
    DiscountDuration,
    DiscountFixed,
    DiscountPercentage,
    DiscountType,
)
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_discount


@pytest.mark.asyncio
class TestListDiscounts:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get("/v1/discounts/")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_valid(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        percentage_discount = await create_discount(
            save_fixture,
            type=DiscountType.percentage,
            basis_points=1000,
            duration=DiscountDuration.once,
            organization=organization,
            name="10% Off",
            code="PERCENT10",
        )
        fixed_discount = await create_discount(
            save_fixture,
            type=DiscountType.fixed,
            amounts={"usd": 500},
            duration=DiscountDuration.once,
            organization=organization,
            name="$5 Off",
            code="FIXED5",
        )

        response = await client.get("/v1/discounts/")

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == 2

        ids = {item["id"] for item in json["items"]}
        assert str(percentage_discount.id) in ids
        assert str(fixed_discount.id) in ids

        percentage_item = next(
            item for item in json["items"] if item["id"] == str(percentage_discount.id)
        )
        assert percentage_item["type"] == "percentage"
        assert percentage_item["basis_points"] == 1000
        assert isinstance(percentage_discount, DiscountPercentage)

        fixed_item = next(
            item for item in json["items"] if item["id"] == str(fixed_discount.id)
        )
        assert fixed_item["type"] == "fixed"
        assert isinstance(fixed_discount, DiscountFixed)


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

    @pytest.mark.parametrize(
        "payload",
        [
            pytest.param(
                {"amount": 1000, "currency": "usd"},
                id="deprecated fields - amount and currency",
            ),
            pytest.param(
                {"amounts": {"usd": 1000}}, id="new field - amounts with usd currency"
            ),
        ],
    )
    @pytest.mark.auth
    async def test_valid_fixed(
        self,
        session: AsyncSession,
        payload: dict[str, Any],
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            "/v1/discounts/",
            json={
                "name": "Discount",
                "type": "fixed",
                "code": "DISCOUNT",
                "duration": "once",
                "organization_id": str(organization.id),
                **payload,
            },
        )

        assert response.status_code == 201
        json = response.json()

        repository = DiscountRepository.from_session(session)
        discount = await repository.get_by_id(json["id"])
        assert discount is not None
        assert isinstance(discount, DiscountFixed)
        assert discount.amounts == {"usd": 1000}
        assert discount.amount == 1000
        assert discount.currency == "usd"
