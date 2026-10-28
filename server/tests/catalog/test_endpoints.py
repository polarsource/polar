from datetime import timedelta

import pytest
from httpx import AsyncClient

from polar.kit.utils import utc_now
from polar.models import (
    Catalog,
    CatalogProduct,
    Organization,
    Product,
    UserOrganization,
)
from polar.models.catalog import CatalogStatus
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture


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
            (item["id"], item["name"], item["status"]) for item in json["items"]
        ] == [
            (str(draft.id), None, "draft"),
            (str(live.id), "Spring pricing", "live"),
            (str(archived.id), None, "archived"),
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

    @pytest.mark.auth
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
        assert json["previous_id"] == str(archived.id)
        assert json["next_id"] is None
        assert json["products"] == [
            {"external_id": "lifetime", "product_id": str(product_one_time.id)},
            {"external_id": "pro", "product_id": str(product_second.id)},
        ]

        response = await client.get(f"/v1/catalogs/{archived.id}")

        json = response.json()
        assert json["previous_id"] is None
        assert json["next_id"] == str(live.id)

        response = await client.get(f"/v1/catalogs/{draft.id}")

        json = response.json()
        assert json["previous_id"] is None
        assert json["next_id"] is None
        assert json["products"] == [
            {"external_id": "pro", "product_id": str(product_second.id)}
        ]
