from datetime import timedelta

import pytest
from httpx import AsyncClient

from polar.kit.utils import utc_now
from polar.models import Catalog, CatalogProduct, Organization, UserOrganization
from polar.models.catalog import CatalogStatus
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_product


@pytest.fixture
async def catalogs(
    save_fixture: SaveFixture, organization: Organization
) -> tuple[Catalog, Catalog]:
    first = await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=None,
        external_id="first",
    )
    second = await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=None,
        external_id="second",
    )
    now = utc_now()
    archived = Catalog(
        organization=organization,
        version_hash="a" * 64,
        status=CatalogStatus.archived,
        published_at=now - timedelta(days=1),
    )
    live = Catalog(
        organization=organization,
        version_hash="b" * 64,
        status=CatalogStatus.live,
        published_at=now,
    )
    draft = Catalog(organization=organization, status=CatalogStatus.draft)
    for catalog in (archived, live, draft):
        await save_fixture(catalog)
    for catalog, products in ((archived, [first]), (live, [first, second])):
        for product in products:
            assert product.external_id is not None
            await save_fixture(
                CatalogProduct(
                    catalog=catalog, product=product, external_id=product.external_id
                )
            )
    return archived, live


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
    )
    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_valid(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        catalogs: tuple[Catalog, Catalog],
    ) -> None:
        archived, live = catalogs

        response = await client.get("/v1/catalogs/")

        assert response.status_code == 200
        json = response.json()
        assert json["pagination"]["total_count"] == 2
        assert [
            (item["id"], item["status"], item["version_hash"], item["product_count"])
            for item in json["items"]
        ] == [
            (str(live.id), "live", live.version_hash, 2),
            (str(archived.id), "archived", archived.version_hash, 1),
        ]
