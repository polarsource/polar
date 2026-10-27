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
            (item["id"], item["name"], item["status"], item["version_hash"])
            for item in json["items"]
        ] == [
            (str(draft.id), None, "draft", None),
            (str(live.id), "Spring pricing", "live", live.version_hash),
            (str(archived.id), None, "archived", archived.version_hash),
        ]

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


@pytest.fixture
async def versions(
    save_fixture: SaveFixture, organization: Organization
) -> tuple[Catalog, Catalog]:
    """Two published versions: `pro` repriced, `legacy` removed, `team` added."""

    async def product(name: str, external_id: str, amount: int, current: bool):
        created = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=None,
            name=name,
            prices=[(amount, "usd")],
            external_id=external_id,
        )
        created.is_current = current
        await save_fixture(created)
        return created

    pro_before = await product("Pro", "pro", 1000, current=False)
    pro_after = await product("Pro", "pro", 2000, current=True)
    starter = await product("Starter", "starter", 500, current=True)
    legacy = await product("Legacy", "legacy", 100, current=False)
    team = await product("Team", "team", 5000, current=True)

    now = utc_now()
    previous = Catalog(
        organization=organization,
        version_hash="a" * 64,
        status=CatalogStatus.archived,
        published_at=now - timedelta(days=1),
    )
    current = Catalog(
        organization=organization,
        name="Spring pricing",
        version_hash="b" * 64,
        status=CatalogStatus.live,
        published_at=now,
    )
    members = (
        (previous, pro_before),
        (previous, starter),
        (previous, legacy),
        (current, pro_after),
        (current, starter),
        (current, team),
    )
    for catalog, member in members:
        await save_fixture(
            CatalogProduct(
                catalog=catalog, product=member, external_id=member.external_id
            )
        )
    return previous, current


@pytest.mark.anyio
class TestGet:
    async def test_anonymous(
        self, client: AsyncClient, versions: tuple[Catalog, Catalog]
    ) -> None:
        _, current = versions

        response = await client.get(f"/v1/catalogs/{current.id}")

        assert response.status_code == 401

    @pytest.mark.auth
    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_not_member(
        self, client: AsyncClient, versions: tuple[Catalog, Catalog]
    ) -> None:
        _, current = versions

        response = await client.get(f"/v1/catalogs/{current.id}")

        assert response.status_code == 404

    @pytest.mark.auth
    @pytest.mark.usefixtures("user_organization")
    async def test_config_as_code_disabled(
        self, client: AsyncClient, versions: tuple[Catalog, Catalog]
    ) -> None:
        _, current = versions

        response = await client.get(f"/v1/catalogs/{current.id}")

        assert response.status_code == 404

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
        AuthSubjectFixture(subject="agent"),
    )
    @pytest.mark.usefixtures("config_as_code_enabled", "user_organization")
    async def test_valid(
        self, client: AsyncClient, versions: tuple[Catalog, Catalog]
    ) -> None:
        previous, current = versions

        response = await client.get(f"/v1/catalogs/{current.id}")

        assert response.status_code == 200
        json = response.json()
        assert json["id"] == str(current.id)
        assert json["name"] == "Spring pricing"
        assert json["previous_version_hash"] == previous.version_hash
        assert [
            (product["external_id"], product["change"], product["name"])
            for product in json["products"]
        ] == [
            ("team", "added", "Team"),
            ("pro", "changed", "Pro"),
            ("legacy", "removed", "Legacy"),
            ("starter", "unchanged", "Starter"),
        ]
        team, pro, legacy, starter = json["products"]
        assert team["previous_product_id"] is None
        assert legacy["product_id"] is None
        assert starter["product_id"] == starter["previous_product_id"]
        assert pro["product_id"] != pro["previous_product_id"]
        assert [change["field"] for change in pro["diff"]] == ["prices"]
        assert pro["diff"][0]["before"][0]["price_amount"] == 1000
        assert pro["diff"][0]["after"][0]["price_amount"] == 2000

    @pytest.mark.auth
    @pytest.mark.usefixtures("config_as_code_enabled", "user_organization")
    async def test_first_version(
        self, client: AsyncClient, versions: tuple[Catalog, Catalog]
    ) -> None:
        previous, _ = versions

        response = await client.get(f"/v1/catalogs/{previous.id}")

        assert response.status_code == 200
        json = response.json()
        assert json["previous_version_hash"] is None
        assert [
            (product["external_id"], product["change"]) for product in json["products"]
        ] == [("legacy", "added"), ("pro", "added"), ("starter", "added")]
