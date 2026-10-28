import uuid
from datetime import timedelta
from typing import Any

import pytest
from httpx import AsyncClient

from polar.enums import SubscriptionRecurringInterval
from polar.kit.utils import utc_now
from polar.models import (
    Benefit,
    Catalog,
    Customer,
    Organization,
    Product,
    ProductPriceFixed,
    UserOrganization,
)
from polar.models.catalog import CatalogStatus
from polar.models.custom_field import CustomFieldType
from polar.models.subscription import SubscriptionStatus
from polar.postgres import AsyncSession
from polar.version import V2026_04, V2026_10, V2027_01
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_custom_field,
    create_customer,
    create_order,
    create_product,
    create_product_unit_based,
    create_subscription,
    set_product_benefits,
)


@pytest.mark.anyio
class TestListProducts:
    async def test_anonymous(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.get(
            "/v1/products/",
            params={"organization_id": str(organization.id)},
        )

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_user_does_not_see_other_organization_products(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        product_organization_second: Product,
    ) -> None:
        response = await client.get("/v1/products/")

        assert response.status_code == 200
        json = response.json()
        assert json["pagination"]["total_count"] == 0

    @pytest.mark.auth
    async def test_with_benefits(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
        product: Product,
        benefits: list[Benefit],
    ) -> None:
        product = await set_product_benefits(
            save_fixture,
            product=product,
            benefits=benefits,
        )

        response = await client.get(
            "/v1/products/",
            params={"organization_id": str(organization.id)},
        )

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == 1

        items = json["items"]
        item = items[0]
        assert item["id"] == str(product.id)
        assert len(item["benefits"]) == len(benefits)
        for benefit in item["benefits"]:
            assert "properties" in benefit

    @pytest.mark.auth
    @pytest.mark.api_version(V2027_01)
    async def test_filter_by_external_id(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        deleted_product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=None,
            external_id="pro",
        )
        deleted_product.set_deleted_at()
        await save_fixture(deleted_product)
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=None,
            external_id="pro",
        )
        archived_product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=None,
            external_id="legacy",
            is_archived=True,
        )
        await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=None,
            external_id="team",
        )

        response = await client.get(
            "/v1/products/", params={"external_id": ["pro", "legacy", "missing"]}
        )

        assert response.status_code == 200
        json = response.json()
        assert {item["id"] for item in json["items"]} == {
            str(product.id),
            str(archived_product.id),
        }

    @pytest.mark.auth
    @pytest.mark.api_version(V2026_10)
    async def test_external_id_filter_ignored_before_2027_01(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=None,
            external_id="pro",
        )
        await create_product(
            save_fixture, organization=organization, recurring_interval=None
        )

        response = await client.get("/v1/products/", params={"external_id": "pro"})

        assert response.status_code == 200
        assert response.json()["pagination"]["total_count"] == 2


@pytest.mark.anyio
class TestGetProduct:
    async def test_anonymous(self, client: AsyncClient, product: Product) -> None:
        response = await client.get(f"/v1/products/{product.id}")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_not_existing(self, client: AsyncClient) -> None:
        response = await client.get(f"/v1/products/{uuid.uuid4()}")

        assert response.status_code == 404

    @pytest.mark.auth
    async def test_user_cannot_access_other_organization_product(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        product_organization_second: Product,
    ) -> None:
        response = await client.get(f"/v1/products/{product_organization_second.id}")

        assert response.status_code == 404

    @pytest.mark.auth
    async def test_valid(
        self,
        client: AsyncClient,
        product: Product,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.get(f"/v1/products/{product.id}")

        assert response.status_code == 200

        json = response.json()
        assert json["id"] == str(product.id)

    @pytest.mark.auth
    async def test_valid_with_benefits(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        product: Product,
        benefits: list[Benefit],
        user_organization: UserOrganization,
    ) -> None:
        product = await set_product_benefits(
            save_fixture,
            product=product,
            benefits=benefits,
        )

        response = await client.get(f"/v1/products/{product.id}")

        assert response.status_code == 200

        json = response.json()
        assert json["id"] == str(product.id)
        assert len(json["benefits"]) == len(benefits)
        for benefit in json["benefits"]:
            assert "properties" in benefit

    @pytest.mark.auth
    async def test_valid_unit_based(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        product = await create_product_unit_based(
            save_fixture,
            organization=organization,
            price_per_unit=2900,
            minimum_units=5,
        )

        response = await client.get(f"/v1/products/{product.id}")

        assert response.status_code == 200
        json = response.json()
        price = json["prices"][0]
        assert price["amount_type"] == "unit_based"
        assert price["minimum_units"] == 5
        assert price["maximum_units"] is None
        assert price["unit_label"] is None
        assert price["tiers"]["type"] == "volume"
        assert price["tiers"]["tiers"] == [{"bound": None, "unit_amount": "2900"}]

    @pytest.mark.api_version(V2026_04, V2026_10)
    @pytest.mark.auth
    async def test_seat_based_before_2027_01(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[("seat", 1500, "usd")],
        )

        response = await client.get(f"/v1/products/{product.id}")

        assert response.status_code == 200
        price = response.json()["prices"][0]
        assert price["seat_tiers"]["tiers"] == [
            {"min_seats": 1, "max_seats": None, "price_per_seat": 1500}
        ]
        assert price["price_per_seat"] == 1500
        assert "tiers" not in price
        assert "minimum_units" not in price
        assert "maximum_units" not in price

    @pytest.mark.api_version(V2027_01)
    @pytest.mark.auth
    async def test_seat_based_2027_01(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[("seat", 1500, "usd")],
        )

        response = await client.get(f"/v1/products/{product.id}")

        assert response.status_code == 200
        price = response.json()["prices"][0]
        assert price["tiers"] == {
            "type": "volume",
            "tiers": [{"bound": None, "unit_amount": "1500"}],
        }
        assert price["minimum_units"] == 1
        assert price["maximum_units"] is None
        assert "seat_tiers" not in price
        assert "price_per_seat" not in price

    @pytest.mark.api_version(V2026_04, V2026_10)
    @pytest.mark.auth
    async def test_price_type_before_2027_01(
        self,
        client: AsyncClient,
        product: Product,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.get(f"/v1/products/{product.id}")

        assert response.status_code == 200
        price = response.json()["prices"][0]
        assert price["type"] == "recurring"
        assert price["recurring_interval"] == product.recurring_interval

    @pytest.mark.api_version(V2027_01)
    @pytest.mark.auth
    async def test_price_type_2027_01(
        self,
        client: AsyncClient,
        product: Product,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.get(f"/v1/products/{product.id}")

        assert response.status_code == 200
        price = response.json()["prices"][0]
        assert "type" not in price
        assert "recurring_interval" not in price


@pytest.mark.anyio
class TestListProductVersions:
    async def test_anonymous(self, client: AsyncClient, product: Product) -> None:
        response = await client.get(f"/v1/products/{product.id}/versions")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_user_cannot_access_other_organization_product(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        product_organization_second: Product,
    ) -> None:
        response = await client.get(
            f"/v1/products/{product_organization_second.id}/versions"
        )

        assert response.status_code == 404

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_valid(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        now = utc_now()
        archived = Catalog(
            organization=organization,
            name="v1",
            status=CatalogStatus.archived,
            published_at=now - timedelta(days=1),
        )
        live = Catalog(
            organization=organization,
            name="v2",
            status=CatalogStatus.live,
            published_at=now,
            parent=archived,
        )
        for catalog in (archived, live):
            await save_fixture(catalog)
        products: list[Product] = []
        for external_id, catalog in (
            ("pro", archived),
            ("pro", live),
            ("basic", live),
        ):
            for previous in products:
                if previous.external_id == external_id:
                    previous.is_current = False
                    await save_fixture(previous)
            product = await create_product(
                save_fixture,
                organization=organization,
                recurring_interval=SubscriptionRecurringInterval.month,
                external_id=external_id,
            )
            product.catalog = catalog
            await save_fixture(product)
            products.append(product)
        old, current, other = products
        for i, (product, status) in enumerate(
            (
                (old, SubscriptionStatus.active),
                (old, SubscriptionStatus.trialing),
                (current, SubscriptionStatus.active),
                (current, SubscriptionStatus.canceled),
                (other, SubscriptionStatus.active),
            )
        ):
            customer = await create_customer(
                save_fixture, organization=organization, email=f"c{i}@example.com"
            )
            await create_subscription(
                save_fixture, product=product, customer=customer, status=status
            )

        response = await client.get(f"/v1/products/{old.id}/versions")

        assert response.status_code == 200
        assert [
            (item["product_id"], item["name"], item["is_current"], item["customers"])
            for item in response.json()
        ] == [
            (str(current.id), "v2", True, 1),
            (str(old.id), "v1", False, 2),
        ]


@pytest.mark.anyio
class TestCreateProduct:
    @pytest.mark.api_version(V2026_10, V2027_01)
    @pytest.mark.auth
    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_config_as_code_enabled(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            "/v1/products/",
            json={
                "name": "Product",
                "organization_id": str(organization.id),
                "prices": [
                    {
                        "amount_type": "fixed",
                        "price_amount": 1000,
                        "price_currency": "usd",
                    }
                ],
            },
        )

        assert response.status_code == 403
        assert response.json()["error"] == "DeclarativeConfigManaged"

    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.post(
            "/v1/products/",
            json={
                "type": "individual",
                "name": "Product",
                "price_amount": 1000,
                "organization_id": str(uuid.uuid4()),
            },
        )

        assert response.status_code == 401

    @pytest.mark.parametrize(
        "payload",
        [
            {"name": "ab"},
            {"name": ""},
            # No price
            {"prices": []},
            # Two prices
            {
                "prices": [
                    {"amount_type": "fixed", "price_amount": 1000},
                    {"amount_type": "fixed", "price_amount": 10000},
                ]
            },
        ],
    )
    @pytest.mark.auth
    async def test_validation(
        self,
        payload: dict[str, Any],
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
        session: AsyncSession,
    ) -> None:
        response = await client.post(
            "/v1/products/",
            json={
                "name": "Product",
                "organization_id": str(organization.id),
                "prices": [
                    {
                        "amount_type": "fixed",
                        "price_amount": 1000,
                        "price_currency": "usd",
                    }
                ],
                **payload,
            },
        )

        assert response.status_code == 422

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="agent"),
    )
    @pytest.mark.parametrize(
        "payload",
        [
            pytest.param(
                {
                    "recurring_interval": None,
                    "prices": [
                        {
                            "amount_type": "fixed",
                            "price_amount": 1000,
                            "price_currency": "usd",
                        }
                    ],
                },
                id="One-time fixed",
            ),
            pytest.param(
                {
                    "recurring_interval": None,
                    "prices": [
                        {
                            "amount_type": "custom",
                            "minimum_amount": 1000,
                            "price_currency": "usd",
                        }
                    ],
                },
                id="One-time custom",
            ),
            pytest.param(
                {
                    "recurring_interval": "day",
                    "prices": [
                        {
                            "amount_type": "fixed",
                            "price_amount": 1000,
                            "price_currency": "usd",
                        }
                    ],
                },
                id="Recurring daily fixed",
            ),
            pytest.param(
                {
                    "recurring_interval": "week",
                    "prices": [
                        {
                            "amount_type": "fixed",
                            "price_amount": 1000,
                            "price_currency": "usd",
                        }
                    ],
                },
                id="Recurring weekly fixed",
            ),
            pytest.param(
                {
                    "recurring_interval": "month",
                    "prices": [
                        {
                            "amount_type": "fixed",
                            "price_amount": 1000,
                            "price_currency": "usd",
                        }
                    ],
                },
                id="Recurring monthly fixed",
            ),
            pytest.param(
                {
                    "recurring_interval": "year",
                    "prices": [
                        {
                            "amount_type": "fixed",
                            "price_amount": 1000,
                            "price_currency": "usd",
                        }
                    ],
                },
                id="Recurring yearly fixed",
            ),
            pytest.param(
                {
                    "recurring_interval": "month",
                    "prices": [
                        {
                            "amount_type": "custom",
                            "minimum_amount": 1000,
                            "price_currency": "usd",
                        }
                    ],
                },
                id="Recurring custom",
            ),
            pytest.param(
                {
                    "recurring_interval": "month",
                    "recurring_interval_count": 3,
                    "prices": [
                        {
                            "amount_type": "fixed",
                            "price_amount": 1000,
                            "price_currency": "usd",
                        }
                    ],
                },
                id="Recurring with interval count",
            ),
        ],
    )
    async def test_valid(
        self,
        payload: dict[str, Any],
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            "/v1/products/",
            json={
                "name": "Product",
                "organization_id": str(organization.id),
                **payload,
            },
        )

        assert response.status_code == 201

    @pytest.mark.auth
    async def test_legacy_free_price_accepted_as_fixed(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        # `free` is no longer a distinct price type, but we still accept it on input
        # for backward compatibility and persist it as a fixed price of amount 0.
        response = await client.post(
            "/v1/products/",
            json={
                "name": "Product",
                "organization_id": str(organization.id),
                "recurring_interval": None,
                "prices": [{"amount_type": "free", "price_currency": "usd"}],
            },
        )

        assert response.status_code == 201
        prices = response.json()["prices"]
        assert len(prices) == 1
        assert prices[0]["amount_type"] == "fixed"
        assert prices[0]["price_amount"] == 0

    @pytest.mark.api_version(V2027_01)
    @pytest.mark.auth
    async def test_seat_based_tiers_2027_01(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        tiers = {
            "type": "graduated",
            "tiers": [
                {"bound": 10, "unit_amount": "1000"},
                {"bound": None, "unit_amount": "800"},
            ],
        }
        response = await client.post(
            "/v1/products/",
            json={
                "name": "Product",
                "organization_id": str(organization.id),
                "recurring_interval": "month",
                "prices": [
                    {
                        "amount_type": "seat_based",
                        "price_currency": "usd",
                        "tiers": tiers,
                        "minimum_units": 2,
                    }
                ],
            },
        )

        assert response.status_code == 201
        price = response.json()["prices"][0]
        assert price["tiers"] == tiers
        assert price["minimum_units"] == 2
        assert price["maximum_units"] is None

    @pytest.mark.api_version(V2027_01)
    @pytest.mark.auth
    async def test_seat_based_seat_tiers_2027_01(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            "/v1/products/",
            json={
                "name": "Product",
                "organization_id": str(organization.id),
                "recurring_interval": "month",
                "prices": [
                    {
                        "amount_type": "seat_based",
                        "price_currency": "usd",
                        "seat_tiers": {
                            "tiers": [
                                {
                                    "min_seats": 1,
                                    "max_seats": None,
                                    "price_per_seat": 1000,
                                }
                            ]
                        },
                    }
                ],
            },
        )

        assert response.status_code == 422
        assert response.json()["detail"][0]["loc"][-1] == "tiers"

    @pytest.mark.api_version(V2026_04, V2026_10)
    @pytest.mark.auth
    async def test_seat_based_seat_tiers_before_2027_01(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            "/v1/products/",
            json={
                "name": "Product",
                "organization_id": str(organization.id),
                "recurring_interval": "month",
                "prices": [
                    {
                        "amount_type": "seat_based",
                        "price_currency": "usd",
                        "seat_tiers": {
                            "tiers": [
                                {
                                    "min_seats": 2,
                                    "max_seats": 10,
                                    "price_per_seat": 1000,
                                },
                                {
                                    "min_seats": 11,
                                    "max_seats": None,
                                    "price_per_seat": 800,
                                },
                            ]
                        },
                    }
                ],
            },
        )

        assert response.status_code == 201
        price = response.json()["prices"][0]
        assert price["seat_tiers"]["tiers"] == [
            {"min_seats": 2, "max_seats": 10, "price_per_seat": 1000},
            {"min_seats": 11, "max_seats": None, "price_per_seat": 800},
        ]

    @pytest.mark.api_version(V2026_04, V2026_10)
    @pytest.mark.auth
    async def test_seat_based_tiers_before_2027_01(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            "/v1/products/",
            json={
                "name": "Product",
                "organization_id": str(organization.id),
                "recurring_interval": "month",
                "prices": [
                    {
                        "amount_type": "seat_based",
                        "price_currency": "usd",
                        "tiers": {
                            "type": "volume",
                            "tiers": [{"bound": None, "unit_amount": "1000"}],
                        },
                    }
                ],
            },
        )

        assert response.status_code == 422
        assert response.json()["detail"][0]["loc"][-1] == "seat_tiers"

    @pytest.mark.api_version(V2027_01)
    @pytest.mark.auth
    async def test_external_id_2027_01(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            "/v1/products/",
            json={
                "name": "Product",
                "organization_id": str(organization.id),
                "external_id": "ext_1337",
                "prices": [
                    {
                        "amount_type": "fixed",
                        "price_amount": 1000,
                        "price_currency": "usd",
                    }
                ],
            },
        )

        assert response.status_code == 201
        assert response.json()["external_id"] == "ext_1337"


@pytest.mark.anyio
class TestUpdateProduct:
    @pytest.mark.api_version(V2026_10, V2027_01)
    @pytest.mark.auth
    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_config_as_code_enabled(
        self,
        client: AsyncClient,
        product: Product,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.patch(
            f"/v1/products/{product.id}",
            json={"name": "Updated Name"},
        )

        assert response.status_code == 403
        assert response.json()["error"] == "DeclarativeConfigManaged"

    async def test_anonymous(self, client: AsyncClient, product: Product) -> None:
        response = await client.patch(
            f"/v1/products/{product.id}",
            json={"name": "Updated Name"},
        )

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_not_existing(self, client: AsyncClient) -> None:
        response = await client.patch(
            f"/v1/products/{uuid.uuid4()}",
            json={"name": "Updated Name"},
        )

        assert response.status_code == 404

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="agent"),
    )
    async def test_cannot_access_other_organization_product(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        product_organization_second: Product,
    ) -> None:
        response = await client.patch(
            f"/v1/products/{product_organization_second.id}",
            json={"name": "Updated Name"},
        )

        assert response.status_code == 404

    @pytest.mark.auth
    async def test_valid(
        self,
        client: AsyncClient,
        product: Product,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.patch(
            f"/v1/products/{product.id}",
            json={"name": "Updated Name"},
        )

        assert response.status_code == 200

        json = response.json()
        assert json["name"] == "Updated Name"

    @pytest.mark.api_version(V2027_01)
    @pytest.mark.auth
    async def test_seat_based_tiers_2027_01(
        self,
        client: AsyncClient,
        product: Product,
        user_organization: UserOrganization,
    ) -> None:
        tiers = {"type": "volume", "tiers": [{"bound": None, "unit_amount": "1200"}]}
        response = await client.patch(
            f"/v1/products/{product.id}",
            json={
                "prices": [
                    {
                        "amount_type": "seat_based",
                        "price_currency": "usd",
                        "tiers": tiers,
                    }
                ]
            },
        )

        assert response.status_code == 200
        price = response.json()["prices"][0]
        assert price["amount_type"] == "seat_based"
        assert price["tiers"] == tiers

    @pytest.mark.auth
    async def test_existing_price_with_full_schema(
        self,
        client: AsyncClient,
        product_one_time: Product,
        user_organization: UserOrganization,
    ) -> None:
        """
        We should handle the case where we want to keep the existing price, but we pass
        the full schema of it.

        It happens from the frontend where it's cumbersome
        to get rid of the full schema.
        """
        response = await client.patch(
            f"/v1/products/{product_one_time.id}",
            json={
                "prices": [
                    {
                        "id": str(product_one_time.prices[0].id),
                        "price_amount": 2000,
                        "price_currency": "usd",
                        "is_archived": False,
                        "amount_type": "fixed",
                    }
                ]
            },
        )

        assert response.status_code == 200

        json = response.json()
        assert len(json["prices"]) == 1
        price = json["prices"][0]
        assert price["id"] == str(product_one_time.prices[0].id)

        product_price = product_one_time.prices[0]
        assert isinstance(product_price, ProductPriceFixed)
        assert price["price_amount"] == product_price.price_amount

    @pytest.mark.auth
    async def test_invalid_attached_custom_fields(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        custom_field = await create_custom_field(
            save_fixture,
            type=CustomFieldType.text,
            slug="test-field",
            organization=organization,
        )
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=None,
            attached_custom_fields=[
                (custom_field, True),
            ],
        )

        response = await client.patch(
            f"/v1/products/{product.id}",
            json={
                "attached_custom_fields": [
                    {
                        "custom_field_id": str(uuid.uuid4()),
                        "required": False,
                    }
                ]
            },
        )

        assert response.status_code == 422


@pytest.mark.anyio
class TestUpdateProductBenefits:
    async def test_anonymous(self, client: AsyncClient, product: Product) -> None:
        response = await client.post(
            f"/v1/products/{product.id}/benefits",
            json={"benefits": []},
        )

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_not_existing(self, client: AsyncClient) -> None:
        response = await client.post(
            f"/v1/products/{uuid.uuid4()}/benefits",
            json={"benefits": []},
        )

        assert response.status_code == 404

    @pytest.mark.auth
    async def test_user_cannot_access_other_organization_product(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        product_organization_second: Product,
    ) -> None:
        response = await client.post(
            f"/v1/products/{product_organization_second.id}/benefits",
            json={"benefits": []},
        )

        assert response.status_code == 404

    @pytest.mark.auth
    async def test_valid(
        self,
        client: AsyncClient,
        product: Product,
        user_organization: UserOrganization,
        benefit_organization: Benefit,
    ) -> None:
        response = await client.post(
            f"/v1/products/{product.id}/benefits",
            json={"benefits": [str(benefit_organization.id)]},
        )

        assert response.status_code == 200

        json = response.json()
        assert len(json["benefits"]) == 1


@pytest.mark.anyio
class TestDeleteProduct:
    @pytest.mark.auth
    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_config_as_code_enabled(
        self,
        client: AsyncClient,
        product: Product,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.delete(f"/v1/products/{product.id}")

        assert response.status_code == 403
        assert response.json()["error"] == "DeclarativeConfigManaged"

    async def test_anonymous(self, client: AsyncClient, product: Product) -> None:
        response = await client.delete(f"/v1/products/{product.id}")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_not_existing(self, client: AsyncClient) -> None:
        response = await client.delete(f"/v1/products/{uuid.uuid4()}")

        assert response.status_code == 404

    @pytest.mark.auth
    async def test_user_cannot_access_other_organization_product(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        product_organization_second: Product,
    ) -> None:
        response = await client.delete(f"/v1/products/{product_organization_second.id}")

        assert response.status_code == 404

    @pytest.mark.auth
    async def test_not_deletable(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
        user_organization: UserOrganization,
    ) -> None:
        await create_order(save_fixture, customer=customer, product=product)

        response = await client.get(f"/v1/products/{product.id}")
        assert response.status_code == 200
        assert response.json()["is_deletable"] is False

        response = await client.delete(f"/v1/products/{product.id}")

        assert response.status_code == 409

    @pytest.mark.auth
    async def test_valid(
        self,
        client: AsyncClient,
        product: Product,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.get(f"/v1/products/{product.id}")
        assert response.status_code == 200
        assert response.json()["is_deletable"] is True

        response = await client.delete(f"/v1/products/{product.id}")

        assert response.status_code == 204

        response = await client.get(f"/v1/products/{product.id}")
        assert response.status_code == 404


@pytest.mark.anyio
class TestNameCheck:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.post(
            "/v1/products/name-check", json={"name": "Casino Night"}
        )

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_flagged_by_word_list(self, client: AsyncClient) -> None:
        response = await client.post(
            "/v1/products/name-check", json={"name": "Casino Night"}
        )

        assert response.status_code == 200
        assert response.json() == {"category": "gambling", "phrase": "Casino"}

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_organization_token_rejected(self, client: AsyncClient) -> None:
        response = await client.post(
            "/v1/products/name-check", json={"name": "Casino Night"}
        )

        assert response.status_code == 401
