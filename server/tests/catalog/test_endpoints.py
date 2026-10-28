from datetime import timedelta

import pytest
from httpx import AsyncClient

from polar.enums import SubscriptionRecurringInterval
from polar.kit.utils import utc_now
from polar.models import Catalog, CatalogProduct, Organization, UserOrganization
from polar.models.catalog import CatalogStatus
from polar.models.subscription import SubscriptionStatus
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_customer,
    create_product,
    create_subscription,
)


@pytest.fixture
async def catalogs(
    save_fixture: SaveFixture, organization: Organization
) -> tuple[Catalog, Catalog, Catalog]:
    now = utc_now()
    archived = Catalog(
        organization=organization,
        version_hash="a" * 64,
        status=CatalogStatus.archived,
        published_at=now - timedelta(days=1),
    )
    live = Catalog(
        organization=organization,
        name="Spring pricing",
        version_hash="b" * 64,
        status=CatalogStatus.live,
        published_at=now,
        parent=archived,
    )
    draft = Catalog(organization=organization, status=CatalogStatus.draft)
    for catalog in (archived, live, draft):
        await save_fixture(catalog)
    return draft, live, archived


@pytest.mark.anyio
class TestList:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get("/v1/catalogs/")

        assert response.status_code == 401

    @pytest.mark.auth
    @pytest.mark.usefixtures("config_as_code_enabled", "catalogs")
    async def test_not_member(self, client: AsyncClient) -> None:
        response = await client.get("/v1/catalogs/")

        assert response.status_code == 200
        assert response.json()["pagination"]["total_count"] == 0

    @pytest.mark.auth
    @pytest.mark.usefixtures("user_organization", "catalogs")
    async def test_config_as_code_disabled(self, client: AsyncClient) -> None:
        response = await client.get("/v1/catalogs/")

        assert response.status_code == 200
        assert response.json()["pagination"]["total_count"] == 0

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
        AuthSubjectFixture(subject="agent"),
    )
    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_valid(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        catalogs: tuple[Catalog, Catalog, Catalog],
    ) -> None:
        draft, live, archived = catalogs

        response = await client.get("/v1/catalogs/")

        assert response.status_code == 200
        json = response.json()
        assert json["pagination"]["total_count"] == 3
        assert [
            (item["id"], item["name"], item["status"], item["parent_id"])
            for item in json["items"]
        ] == [
            (str(draft.id), None, "draft", None),
            (str(live.id), "Spring pricing", "live", str(archived.id)),
            (str(archived.id), None, "archived", None),
        ]
        assert all("version_hash" not in item for item in json["items"])

    @pytest.mark.auth
    @pytest.mark.usefixtures("config_as_code_enabled", "user_organization")
    async def test_status_filter(
        self, client: AsyncClient, catalogs: tuple[Catalog, Catalog, Catalog]
    ) -> None:
        _, live, archived = catalogs

        response = await client.get(
            "/v1/catalogs/", params={"status": ["live", "archived"]}
        )

        assert response.status_code == 200
        assert [item["id"] for item in response.json()["items"]] == [
            str(live.id),
            str(archived.id),
        ]

    @pytest.mark.auth
    @pytest.mark.usefixtures("config_as_code_enabled", "user_organization")
    async def test_published_filter(
        self, client: AsyncClient, catalogs: tuple[Catalog, Catalog, Catalog]
    ) -> None:
        _, live, archived = catalogs
        assert live.published_at is not None
        cutoff = (live.published_at - timedelta(hours=1)).isoformat()

        response = await client.get("/v1/catalogs/", params={"published_after": cutoff})

        assert response.status_code == 200
        assert [item["id"] for item in response.json()["items"]] == [str(live.id)]

        response = await client.get(
            "/v1/catalogs/", params={"published_before": cutoff}
        )

        assert response.status_code == 200
        assert [item["id"] for item in response.json()["items"]] == [str(archived.id)]

    @pytest.mark.auth
    @pytest.mark.usefixtures("config_as_code_enabled", "user_organization")
    async def test_customers(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        catalogs: tuple[Catalog, Catalog, Catalog],
    ) -> None:
        draft, live, archived = catalogs
        old_pro, pro, basic = [
            await create_product(
                save_fixture,
                organization=organization,
                recurring_interval=SubscriptionRecurringInterval.month,
            )
            for _ in range(3)
        ]
        for catalog, product, external_id in (
            (archived, old_pro, "pro"),
            (archived, basic, "basic"),
            (live, pro, "pro"),
            (live, basic, "basic"),
            (draft, old_pro, "pro"),
        ):
            await save_fixture(
                CatalogProduct(
                    catalog=catalog, product=product, external_id=external_id
                )
            )
        grandfathered, current, churned = [
            await create_customer(
                save_fixture, organization=organization, email=f"{name}@example.com"
            )
            for name in ("grandfathered", "current", "churned")
        ]
        for customer, product, status in (
            (grandfathered, old_pro, SubscriptionStatus.active),
            (current, pro, SubscriptionStatus.active),
            (current, basic, SubscriptionStatus.trialing),
            (churned, old_pro, SubscriptionStatus.canceled),
        ):
            await create_subscription(
                save_fixture, product=product, customer=customer, status=status
            )

        response = await client.get("/v1/catalogs/")

        assert response.status_code == 200
        assert {item["id"]: item["customers"] for item in response.json()["items"]} == {
            str(draft.id): 0,
            str(live.id): 1,
            str(archived.id): 1,
        }

    @pytest.mark.auth
    @pytest.mark.usefixtures("config_as_code_enabled", "user_organization")
    async def test_published_filter_requires_utc_offset(
        self, client: AsyncClient
    ) -> None:
        response = await client.get(
            "/v1/catalogs/", params={"published_after": "2026-10-01T00:00:00"}
        )

        assert response.status_code == 422
