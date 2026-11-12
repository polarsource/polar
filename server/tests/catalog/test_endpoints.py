from datetime import timedelta

import pytest
from httpx import AsyncClient

from polar.auth.scope import Scope
from polar.enums import SubscriptionRecurringInterval
from polar.kit.utils import utc_now
from polar.models import (
    Catalog,
    CatalogBenefit,
    CatalogProduct,
    Customer,
    Organization,
    Product,
    UserOrganization,
)
from polar.models.catalog import CatalogStatus
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_active_subscription,
    create_benefit,
    create_benefit_grant,
    create_product,
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
    async def test_published_filter_requires_utc_offset(
        self, client: AsyncClient
    ) -> None:
        response = await client.get(
            "/v1/catalogs/", params={"published_after": "2026-10-01T00:00:00"}
        )

        assert response.status_code == 422


@pytest.mark.anyio
class TestGet:
    async def test_anonymous(
        self, client: AsyncClient, catalogs: tuple[Catalog, Catalog, Catalog]
    ) -> None:
        _, live, _ = catalogs

        response = await client.get(f"/v1/catalogs/{live.id}")

        assert response.status_code == 401

    @pytest.mark.auth
    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_not_member(
        self, client: AsyncClient, catalogs: tuple[Catalog, Catalog, Catalog]
    ) -> None:
        _, live, _ = catalogs

        response = await client.get(f"/v1/catalogs/{live.id}")

        assert response.status_code == 404

    @pytest.mark.auth
    @pytest.mark.usefixtures("user_organization", "catalogs")
    async def test_config_as_code_disabled(
        self, client: AsyncClient, catalogs: tuple[Catalog, Catalog, Catalog]
    ) -> None:
        _, live, _ = catalogs

        response = await client.get(f"/v1/catalogs/{live.id}")

        assert response.status_code == 404

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
        AuthSubjectFixture(subject="agent"),
    )
    @pytest.mark.usefixtures("config_as_code_enabled", "user_organization")
    async def test_valid(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        catalogs: tuple[Catalog, Catalog, Catalog],
        product: Product,
        product_second: Product,
        product_one_time: Product,
    ) -> None:
        draft, live, archived = catalogs
        for catalog, catalog_product, external_id in (
            (archived, product, "pro"),
            (archived, product_one_time, "lifetime"),
            (live, product_second, "pro"),
            (live, product_one_time, "lifetime"),
            (draft, product_second, "pro"),
        ):
            await save_fixture(
                CatalogProduct(
                    catalog=catalog, product=catalog_product, external_id=external_id
                )
            )

        response = await client.get(f"/v1/catalogs/{live.id}")

        assert response.status_code == 200
        json = response.json()
        assert json["id"] == str(live.id)
        assert json["parent_id"] == str(archived.id)
        assert json["products"] == [
            {"external_id": "lifetime", "product_id": str(product_one_time.id)},
            {"external_id": "pro", "product_id": str(product_second.id)},
        ]

        response = await client.get(f"/v1/catalogs/{draft.id}")

        json = response.json()
        assert json["products"] == [
            {"external_id": "pro", "product_id": str(product_second.id)}
        ]


@pytest.fixture
async def products_only_draft(
    save_fixture: SaveFixture,
    organization: Organization,
    catalogs: tuple[Catalog, Catalog, Catalog],
) -> Catalog:
    draft, _, _ = catalogs
    product = await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=None,
        is_current=False,
        catalog=draft,
    )
    await save_fixture(
        CatalogProduct(catalog=draft, product=product, external_id="pro")
    )
    return draft


@pytest.fixture
async def benefits_draft(
    save_fixture: SaveFixture,
    organization: Organization,
    products_only_draft: Catalog,
) -> Catalog:
    benefit = await create_benefit(
        save_fixture,
        organization=organization,
        is_current=False,
        catalog=products_only_draft,
    )
    await save_fixture(
        CatalogBenefit(catalog=products_only_draft, benefit=benefit, external_id="beta")
    )
    return products_only_draft


PUBLISHERS = (
    AuthSubjectFixture(subject="user"),
    AuthSubjectFixture(subject="organization"),
    AuthSubjectFixture(subject="agent"),
)


def _with_scopes(*scopes: Scope) -> tuple[AuthSubjectFixture, ...]:
    return tuple(
        AuthSubjectFixture(subject=fixture.subject, scopes=set(scopes))
        for fixture in PUBLISHERS
    )


@pytest.mark.anyio
@pytest.mark.usefixtures("config_as_code_enabled", "user_organization")
class TestPublish:
    async def test_anonymous(
        self, client: AsyncClient, products_only_draft: Catalog
    ) -> None:
        response = await client.post(f"/v1/catalogs/{products_only_draft.id}/publish")

        assert response.status_code == 401

    @pytest.mark.auth(*_with_scopes(Scope.benefits_write))
    async def test_without_products_write(
        self, client: AsyncClient, products_only_draft: Catalog
    ) -> None:
        response = await client.post(f"/v1/catalogs/{products_only_draft.id}/publish")

        assert response.status_code == 403

    @pytest.mark.auth(*_with_scopes(Scope.products_write))
    async def test_products_only(
        self, client: AsyncClient, products_only_draft: Catalog
    ) -> None:
        response = await client.post(f"/v1/catalogs/{products_only_draft.id}/publish")

        assert response.status_code == 200
        assert response.json()["status"] == CatalogStatus.live

    @pytest.mark.auth(*_with_scopes(Scope.products_write))
    async def test_benefit_changes_without_benefits_write(
        self, client: AsyncClient, benefits_draft: Catalog
    ) -> None:
        response = await client.post(f"/v1/catalogs/{benefits_draft.id}/publish")

        assert response.status_code == 403
        assert response.json()["error"] == "insufficient_scope"

    @pytest.mark.auth(*_with_scopes(Scope.products_write))
    async def test_removes_live_benefit_without_benefits_write(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        catalogs: tuple[Catalog, Catalog, Catalog],
        products_only_draft: Catalog,
    ) -> None:
        _, live, _ = catalogs
        benefit = await create_benefit(save_fixture, organization=organization)
        await save_fixture(
            CatalogBenefit(catalog=live, benefit=benefit, external_id="beta")
        )

        response = await client.post(f"/v1/catalogs/{products_only_draft.id}/publish")

        assert response.status_code == 403
        assert response.json()["error"] == "insufficient_scope"

    @pytest.mark.auth(*_with_scopes(Scope.products_write, Scope.benefits_write))
    async def test_benefit_changes(
        self, client: AsyncClient, benefits_draft: Catalog
    ) -> None:
        response = await client.post(f"/v1/catalogs/{benefits_draft.id}/publish")

        assert response.status_code == 200
        assert response.json()["status"] == CatalogStatus.live

    @pytest.mark.auth
    async def test_not_draft(
        self, client: AsyncClient, catalogs: tuple[Catalog, Catalog, Catalog]
    ) -> None:
        _, live, _ = catalogs

        response = await client.post(f"/v1/catalogs/{live.id}/publish")

        assert response.status_code == 409
        assert response.json()["error"] == "CatalogNotDraft"


@pytest.mark.anyio
class TestListRemoved:
    async def test_anonymous(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.get(
            "/v1/catalogs/removed", params={"organization_id": str(organization.id)}
        )

        assert response.status_code == 401

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
        AuthSubjectFixture(subject="agent"),
    )
    @pytest.mark.usefixtures("config_as_code_enabled", "user_organization")
    async def test_valid(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
    ) -> None:
        now = utc_now()
        v1, v2, v3 = (
            Catalog(
                organization=organization,
                name=f"v{n}",
                version_hash=str(n) * 64,
                status=CatalogStatus.live if n == 3 else CatalogStatus.archived,
                published_at=now - timedelta(days=4 - n),
            )
            for n in (1, 2, 3)
        )
        for catalog in (v1, v2, v3):
            await save_fixture(catalog)

        products = {
            external_id: await create_product(
                save_fixture,
                organization=organization,
                name=external_id.title(),
                external_id=external_id,
                recurring_interval=SubscriptionRecurringInterval.month,
            )
            for external_id in ("free", "team", "lifetime", "pro")
        }
        for catalog, external_id in (
            (v1, "free"),
            (v3, "free"),
            (v2, "team"),
            (v1, "lifetime"),
            (v1, "pro"),
            (v3, "pro"),
        ):
            await save_fixture(
                CatalogProduct(
                    catalog=catalog,
                    product=products[external_id],
                    external_id=external_id,
                )
            )
        await create_active_subscription(
            save_fixture, product=products["team"], customer=customer
        )

        perk = await create_benefit(
            save_fixture, organization=organization, external_id="perk"
        )
        await save_fixture(CatalogBenefit(catalog=v2, benefit=perk, external_id="perk"))
        await create_benefit_grant(save_fixture, customer, perk, granted=True)

        response = await client.get(
            "/v1/catalogs/removed", params={"organization_id": str(organization.id)}
        )

        assert response.status_code == 200
        assert [
            (
                item["resource"],
                item["external_id"],
                item["status"],
                item["customers_count"],
                item["first_catalog"]["id"],
                item["last_catalog"]["id"],
                item["last_item_id"],
                item["removed_in_catalog"]["id"],
            )
            for item in response.json()
        ] == [
            (
                "benefit",
                "perk",
                "deprecated",
                1,
                *map(str, (v2.id, v2.id, perk.id, v3.id)),
            ),
            (
                "product",
                "team",
                "deprecated",
                1,
                *map(str, (v2.id, v2.id, products["team"].id, v3.id)),
            ),
            (
                "product",
                "lifetime",
                "removed",
                0,
                *map(str, (v1.id, v1.id, products["lifetime"].id, v2.id)),
            ),
        ]
