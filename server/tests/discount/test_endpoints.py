import uuid
from typing import Any

import pytest
from httpx import AsyncClient

from polar.discount.repository import DiscountRepository
from polar.kit.versioning import APIVersion
from polar.models import Discount, Organization, UserOrganization
from polar.models.discount import (
    DiscountDuration,
    DiscountFixed,
    DiscountPercentage,
    DiscountType,
)
from polar.postgres import AsyncSession
from polar.version import V2026_04, V2026_10, V2027_01
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_discount


@pytest.fixture
async def discount_organization_second(
    save_fixture: SaveFixture,
    organization_second: Organization,
) -> Discount:
    return await create_discount(
        save_fixture,
        type=DiscountType.percentage,
        basis_points=1000,
        duration=DiscountDuration.once,
        organization=organization_second,
    )


@pytest.mark.anyio
class TestListDiscounts:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get("/v1/discounts/")

        assert response.status_code == 401

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="agent"),
    )
    async def test_does_not_see_other_organization_discounts(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        discount_organization_second: Discount,
    ) -> None:
        response = await client.get("/v1/discounts/")

        assert response.status_code == 200
        json = response.json()
        assert json["pagination"]["total_count"] == 0

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

    @pytest.mark.auth
    @pytest.mark.api_version(V2026_04, V2026_10, V2027_01)
    async def test_filter_by_external_id(
        self,
        api_version: APIVersion,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        deleted_discount = await create_discount(
            save_fixture,
            type=DiscountType.percentage,
            basis_points=1000,
            duration=DiscountDuration.once,
            organization=organization,
            external_id="launch",
        )
        deleted_discount.set_deleted_at()
        await save_fixture(deleted_discount)
        discount = await create_discount(
            save_fixture,
            type=DiscountType.percentage,
            basis_points=1000,
            duration=DiscountDuration.once,
            organization=organization,
            external_id="launch",
        )
        partner_discount = await create_discount(
            save_fixture,
            type=DiscountType.percentage,
            basis_points=2000,
            duration=DiscountDuration.once,
            organization=organization,
            external_id="partner",
        )

        response = await client.get(
            "/v1/discounts/", params={"external_id": ["launch", "missing"]}
        )

        assert response.status_code == 200
        json = response.json()
        if api_version == V2027_01:
            assert [item["id"] for item in json["items"]] == [str(discount.id)]
            assert json["items"][0]["external_id"] == "launch"
        else:
            assert {item["id"] for item in json["items"]} == {
                str(discount.id),
                str(partner_discount.id),
            }


@pytest.mark.anyio
class TestCreateDiscount:
    @pytest.mark.api_version(V2026_10, V2027_01)
    @pytest.mark.auth
    async def test_amounts_with_legacy_inputs(
        self,
        api_version: APIVersion,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            "/v1/discounts/",
            json={
                "name": "Discount",
                "type": "fixed",
                "duration": "once",
                "organization_id": str(organization.id),
                "amounts": {"usd": 1000},
                "amount": 2000,
                "currency": "eur",
            },
        )
        if api_version == V2026_10:
            assert response.status_code == 422
        else:
            assert response.status_code == 201
            data = response.json()
            assert data["amounts"] == {"usd": 1000}
            assert "amount" not in data
            assert "currency" not in data

    @pytest.mark.api_version(V2027_01)
    @pytest.mark.auth
    async def test_legacy_amount_does_not_replace_required_amounts(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            "/v1/discounts/",
            json={
                "name": "Discount",
                "type": "fixed",
                "duration": "once",
                "organization_id": str(organization.id),
                "amount": 1000,
            },
        )
        assert response.status_code == 422
        assert any(error["loc"][-1] == "amounts" for error in response.json()["detail"])

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
    async def test_empty_amounts(
        self,
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
                "amounts": {},
                "duration": "once",
                "organization_id": str(organization.id),
            },
        )

        assert response.status_code == 422

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="agent"),
    )
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

    @pytest.mark.auth
    async def test_valid_max_redemptions_per_customer(
        self,
        session: AsyncSession,
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
                "max_redemptions_per_customer": 3,
                "organization_id": str(organization.id),
            },
        )

        assert response.status_code == 201
        json = response.json()
        assert json["max_redemptions_per_customer"] == 3

        repository = DiscountRepository.from_session(session)
        discount = await repository.get_by_id(json["id"])
        assert discount is not None
        assert discount.max_redemptions_per_customer == 3

    @pytest.mark.auth
    async def test_max_redemptions_per_customer_zero_rejected(
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
                "max_redemptions_per_customer": 0,
                "organization_id": str(organization.id),
            },
        )

        assert response.status_code == 422

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

    @pytest.mark.auth
    async def test_fixed_type_with_basis_points_rejected(
        self,
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
                "basis_points": 10000,
                "organization_id": str(organization.id),
            },
        )

        assert response.status_code == 422

    @pytest.mark.parametrize(
        ("duration", "extra"),
        [
            pytest.param("once", {}, id="once"),
            pytest.param("forever", {}, id="forever"),
            pytest.param("repeating", {"duration_in_months": 3}, id="repeating"),
        ],
    )
    @pytest.mark.auth
    async def test_valid_percentage_durations(
        self,
        duration: str,
        extra: dict[str, Any],
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            "/v1/discounts/",
            json={
                "name": "Discount",
                "type": "percentage",
                "duration": duration,
                "basis_points": 1000,
                "organization_id": str(organization.id),
                **extra,
            },
        )

        assert response.status_code == 201
        assert response.json()["type"] == "percentage"
        assert response.json()["duration"] == duration

    @pytest.mark.parametrize(
        ("duration", "extra"),
        [
            pytest.param("once", {}, id="once"),
            pytest.param("forever", {}, id="forever"),
            pytest.param("repeating", {"duration_in_months": 3}, id="repeating"),
        ],
    )
    @pytest.mark.auth
    async def test_valid_fixed_durations(
        self,
        duration: str,
        extra: dict[str, Any],
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            "/v1/discounts/",
            json={
                "name": "Discount",
                "type": "fixed",
                "duration": duration,
                "amounts": {"usd": 500},
                "organization_id": str(organization.id),
                **extra,
            },
        )

        assert response.status_code == 201
        assert response.json()["type"] == "fixed"
        assert response.json()["duration"] == duration


@pytest.mark.anyio
class TestGetDiscount:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get(f"/v1/discounts/{uuid.uuid4()}")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_user_cannot_access_other_organization_discount(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        discount_organization_second: Discount,
    ) -> None:
        response = await client.get(f"/v1/discounts/{discount_organization_second.id}")

        assert response.status_code == 404


@pytest.mark.anyio
class TestUpdateDiscount:
    @pytest.mark.api_version(V2027_01)
    @pytest.mark.auth
    async def test_removed_amount_and_currency_are_ignored(
        self,
        client: AsyncClient,
        discount_fixed_once: DiscountFixed,
        user_organization: UserOrganization,
    ) -> None:
        amounts = dict(discount_fixed_once.amounts)
        response = await client.patch(
            f"/v1/discounts/{discount_fixed_once.id}",
            json={
                "amount": 1234,
                "currency": "eur",
            },
        )
        assert response.status_code == 200
        assert response.json()["amounts"] == amounts
        assert "amount" not in response.json()
        assert "currency" not in response.json()

    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.patch(f"/v1/discounts/{uuid.uuid4()}")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_user_cannot_access_other_organization_discount(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        discount_organization_second: Discount,
    ) -> None:
        response = await client.patch(
            f"/v1/discounts/{discount_organization_second.id}",
            json={"name": "Updated"},
        )

        assert response.status_code == 404

    @pytest.mark.auth
    async def test_update_max_redemptions_per_customer(
        self,
        session: AsyncSession,
        client: AsyncClient,
        user_organization: UserOrganization,
        discount_fixed_once: Discount,
    ) -> None:
        response = await client.patch(
            f"/v1/discounts/{discount_fixed_once.id}",
            json={"max_redemptions_per_customer": 5},
        )

        assert response.status_code == 200
        json = response.json()
        assert json["max_redemptions_per_customer"] == 5

        repository = DiscountRepository.from_session(session)
        updated = await repository.get_by_id(discount_fixed_once.id)
        assert updated is not None
        assert updated.max_redemptions_per_customer == 5


@pytest.mark.anyio
class TestDeleteDiscount:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.delete(f"/v1/discounts/{uuid.uuid4()}")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_user_cannot_access_other_organization_discount(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        discount_organization_second: Discount,
    ) -> None:
        response = await client.delete(
            f"/v1/discounts/{discount_organization_second.id}"
        )

        assert response.status_code == 404
