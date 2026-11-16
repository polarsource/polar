import uuid

import pytest
from httpx import AsyncClient
from pytest_mock import MockerFixture

from polar.models import CatalogMigration, Organization, Product, UserOrganization
from polar.version import V2027_01
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_product


@pytest.fixture
async def catalog_migration(
    save_fixture: SaveFixture,
    organization: Organization,
    old_pro: Product,
    new_pro: Product,
) -> CatalogMigration:
    catalog_migration = CatalogMigration(
        organization=organization,
        source_product_ids=[old_pro.id],
        target_product=new_pro,
    )
    await save_fixture(catalog_migration)
    return catalog_migration


@pytest.mark.anyio
@pytest.mark.api_version(V2027_01)
class TestCreate:
    async def test_anonymous(
        self, client: AsyncClient, old_pro: Product, new_pro: Product
    ) -> None:
        response = await client.post(
            "/v1/catalog-migrations/",
            json={
                "source_product_ids": [str(old_pro.id)],
                "target_product_id": str(new_pro.id),
            },
        )

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_not_current_target(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        old_pro: Product,
        new_pro: Product,
    ) -> None:
        response = await client.post(
            "/v1/catalog-migrations/",
            json={
                "source_product_ids": [str(new_pro.id)],
                "target_product_id": str(old_pro.id),
            },
        )

        assert response.status_code == 422
        assert response.json()["detail"][0]["loc"] == ["body", "target_product_id"]

    @pytest.mark.auth
    async def test_one_time_target(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
        old_pro: Product,
    ) -> None:
        bundle = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=None,
            external_id="bundle",
        )

        response = await client.post(
            "/v1/catalog-migrations/",
            json={
                "source_product_ids": [str(old_pro.id)],
                "target_product_id": str(bundle.id),
            },
        )

        assert response.status_code == 422
        assert response.json()["detail"][0]["loc"] == ["body", "target_product_id"]

    @pytest.mark.auth
    async def test_source_not_a_version_of_target(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
        old_pro: Product,
        new_pro: Product,
    ) -> None:
        starter = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=new_pro.recurring_interval,
            external_id="starter",
        )

        response = await client.post(
            "/v1/catalog-migrations/",
            json={
                "source_product_ids": [
                    str(old_pro.id),
                    str(starter.id),
                    str(new_pro.id),
                ],
                "target_product_id": str(new_pro.id),
            },
        )

        assert response.status_code == 422
        assert [error["loc"] for error in response.json()["detail"]] == [
            ["body", "source_product_ids", 1],
            ["body", "source_product_ids", 2],
        ]

    @pytest.mark.auth
    async def test_without_config_as_code(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
        old_pro: Product,
        new_pro: Product,
    ) -> None:
        organization.feature_settings = {}
        await save_fixture(organization)

        response = await client.post(
            "/v1/catalog-migrations/",
            json={
                "source_product_ids": [str(old_pro.id)],
                "target_product_id": str(new_pro.id),
            },
        )

        assert response.status_code == 403

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_valid(
        self,
        mocker: MockerFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
        old_pro: Product,
        new_pro: Product,
    ) -> None:
        enqueue_job_mock = mocker.patch("polar.catalog_migration.service.enqueue_job")

        response = await client.post(
            "/v1/catalog-migrations/",
            json={
                "source_product_ids": [str(old_pro.id)],
                "target_product_id": str(new_pro.id),
            },
        )

        assert response.status_code == 201
        json = response.json()
        assert json["organization_id"] == str(organization.id)
        assert json["source_product_ids"] == [str(old_pro.id)]
        assert json["target_product_id"] == str(new_pro.id)
        assert json["status"] == "running"
        assert json["moved_count"] == 0
        assert json["skipped_count"] == 0
        assert json["completed_at"] is None
        enqueue_job_mock.assert_called_once_with(
            "catalog_migration.run", catalog_migration_id=uuid.UUID(json["id"])
        )


@pytest.mark.anyio
@pytest.mark.api_version(V2027_01)
class TestGet:
    @pytest.mark.auth
    async def test_not_found(
        self, client: AsyncClient, user_organization: UserOrganization
    ) -> None:
        response = await client.get(f"/v1/catalog-migrations/{uuid.uuid4()}")

        assert response.status_code == 404

    @pytest.mark.auth
    async def test_not_a_member(
        self, client: AsyncClient, catalog_migration: CatalogMigration
    ) -> None:
        response = await client.get(f"/v1/catalog-migrations/{catalog_migration.id}")

        assert response.status_code == 404

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_valid(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        catalog_migration: CatalogMigration,
    ) -> None:
        response = await client.get(f"/v1/catalog-migrations/{catalog_migration.id}")

        assert response.status_code == 200
        assert response.json()["id"] == str(catalog_migration.id)
