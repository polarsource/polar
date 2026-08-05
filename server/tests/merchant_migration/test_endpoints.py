from collections.abc import AsyncIterator

import pytest
import stripe as stripe_lib
from httpx import AsyncClient
from pytest_mock import MockerFixture

from polar.auth.scope import Scope
from polar.merchant_migration.canonical import (
    CanonicalAccount,
    CanonicalCustomer,
    CanonicalPrice,
    CanonicalPricingScheme,
    CanonicalProduct,
    CanonicalRecord,
)
from polar.merchant_migration.repository import MerchantMigrationRepository
from polar.models import MerchantMigration, Organization, UserOrganization
from polar.models.merchant_migration import (
    MerchantMigrationSourcePlatform,
    MerchantMigrationStep,
)
from polar.postgres import AsyncSession
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.merchant_migration._helpers import build_connected_migration

VALID_BODY = {
    "source_platform": "stripe",
    "api_key": "rk_test_123",
}


def _body(organization: Organization, **overrides: object) -> dict[str, object]:
    return {**VALID_BODY, "organization_id": str(organization.id), **overrides}


async def _enable_feature(
    save_fixture: SaveFixture, organization: Organization
) -> None:
    organization.feature_settings = {
        **organization.feature_settings,
        "merchant_migration_enabled": True,
    }
    await save_fixture(organization)


def _mock_stripe_adapter(
    mocker: MockerFixture,
    *,
    missing_scopes: list[str] | None = None,
    auth_error: Exception | None = None,
) -> None:
    adapter = mocker.MagicMock()
    if auth_error is not None:
        adapter.verify_scopes = mocker.AsyncMock(side_effect=auth_error)
    else:
        adapter.verify_scopes = mocker.AsyncMock(return_value=missing_scopes or [])
    adapter.get_account_id = mocker.AsyncMock(return_value="acct_test")
    mocker.patch("polar.merchant_migration.service.StripeAdapter", return_value=adapter)


@pytest.mark.asyncio
class TestCreate:
    async def test_anonymous(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.post(
            "/v1/merchant-migrations/", json=_body(organization)
        )
        assert response.status_code == 401

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.organizations_write}))
    async def test_not_member_returns_403(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.post(
            "/v1/merchant-migrations/", json=_body(organization)
        )
        assert response.status_code == 403

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.organizations_write}))
    async def test_feature_disabled_returns_403(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            "/v1/merchant-migrations/", json=_body(organization)
        )
        assert response.status_code == 403

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.organizations_write}))
    async def test_invalid_key_format_returns_422(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        await _enable_feature(save_fixture, organization)
        response = await client.post(
            "/v1/merchant-migrations/", json=_body(organization, api_key="nope")
        )
        assert response.status_code == 422

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.organizations_write}))
    async def test_missing_scopes_returns_400(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        mocker: MockerFixture,
    ) -> None:
        await _enable_feature(save_fixture, organization)
        _mock_stripe_adapter(mocker, missing_scopes=["Subscriptions (write)"])

        response = await client.post(
            "/v1/merchant-migrations/", json=_body(organization)
        )
        assert response.status_code == 400
        assert "Subscriptions (write)" in response.text

        repository = MerchantMigrationRepository.from_session(session)
        migrations = await repository.get_all(
            repository.get_base_statement().where(
                MerchantMigration.organization_id == organization.id
            )
        )
        assert len(migrations) == 0

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.organizations_write}))
    async def test_invalid_key_returns_400(
        self,
        client: AsyncClient,
        organization: Organization,
        save_fixture: SaveFixture,
        user_organization: UserOrganization,
        mocker: MockerFixture,
    ) -> None:
        await _enable_feature(save_fixture, organization)
        _mock_stripe_adapter(
            mocker, auth_error=stripe_lib.AuthenticationError("bad key")
        )

        response = await client.post(
            "/v1/merchant-migrations/", json=_body(organization)
        )
        assert response.status_code == 400

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.organizations_write}))
    async def test_creates_connected_migration(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        mocker: MockerFixture,
    ) -> None:
        await _enable_feature(save_fixture, organization)
        _mock_stripe_adapter(mocker)

        response = await client.post(
            "/v1/merchant-migrations/", json=_body(organization)
        )
        assert response.status_code == 201
        body = response.json()
        assert body["source_platform"] == "stripe"
        assert body["step"] == "source_setup"
        assert body["source_connected"] is True
        assert body["source"]["stripe_user_id"] == "acct_test"
        assert "source_credentials" not in body

        repository = MerchantMigrationRepository.from_session(session)
        stored = await repository.get_by_id(body["id"])
        assert stored is not None
        assert stored.source_credentials["api_key_encrypted"].startswith("v1.")


@pytest.mark.asyncio
class TestGet:
    async def test_anonymous(
        self, client: AsyncClient, save_fixture: SaveFixture, organization: Organization
    ) -> None:
        migration = await _create_migration(save_fixture, organization)
        response = await client.get(f"/v1/merchant-migrations/{migration.id}")
        assert response.status_code == 401

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.organizations_read}))
    async def test_not_member_returns_404(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization_second: Organization,
    ) -> None:
        migration = await _create_migration(save_fixture, organization_second)
        response = await client.get(f"/v1/merchant-migrations/{migration.id}")
        assert response.status_code == 404

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.organizations_read}))
    async def test_member_returns_migration(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        migration = await _create_migration(save_fixture, organization)
        response = await client.get(f"/v1/merchant-migrations/{migration.id}")
        assert response.status_code == 200
        json_body = response.json()
        assert json_body["id"] == str(migration.id)
        assert json_body["source_platform"] == "stripe"
        assert "source_credentials" not in json_body


@pytest.mark.asyncio
class TestList:
    async def test_anonymous(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.get(
            "/v1/merchant-migrations/",
            params={"organization_id": str(organization.id)},
        )
        assert response.status_code == 401

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.organizations_read}))
    async def test_returns_only_org_migrations(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        organization_second: Organization,
        user_organization: UserOrganization,
    ) -> None:
        migration = await _create_migration(save_fixture, organization)
        await _create_migration(save_fixture, organization_second)

        response = await client.get(
            "/v1/merchant-migrations/",
            params={"organization_id": str(organization.id)},
        )
        assert response.status_code == 200
        json_body = response.json()
        assert json_body["pagination"]["total_count"] == 1
        item = json_body["items"][0]
        assert item["id"] == str(migration.id)
        assert item["step"] == "source_setup"
        assert "source_credentials" not in item


@pytest.mark.asyncio
class TestPrecheck:
    async def test_anonymous(
        self, client: AsyncClient, save_fixture: SaveFixture, organization: Organization
    ) -> None:
        migration = await _create_migration(save_fixture, organization)
        response = await client.post(f"/v1/merchant-migrations/{migration.id}/precheck")
        assert response.status_code == 401

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.organizations_write}))
    async def test_runs_and_returns_report(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        mocker: MockerFixture,
    ) -> None:
        migration = await build_connected_migration(save_fixture, organization)

        adapter = mocker.MagicMock()
        adapter.extract.return_value = _empty_extract()
        adapter.get_source_account = mocker.AsyncMock(
            return_value=CanonicalAccount(country="US", is_connect_platform=False)
        )
        mocker.patch(
            "polar.merchant_migration.service.StripeAdapter", return_value=adapter
        )

        response = await client.post(f"/v1/merchant-migrations/{migration.id}/precheck")
        assert response.status_code == 200
        json_body = response.json()
        assert json_body["can_start"] is True
        assert json_body["issues"] == []


async def _empty_extract() -> AsyncIterator[object]:
    return
    yield


async def _catalog_extract() -> AsyncIterator[CanonicalRecord]:
    yield CanonicalProduct(
        source_id="prod_1:month:1",
        product_source_id="prod_1",
        name="Pro",
        recurring_interval="month",
        recurring_interval_count=1,
        prices=[
            CanonicalPrice(
                source_id="price_1",
                currency="usd",
                amount=1000,
                pricing_scheme=CanonicalPricingScheme.fixed,
            )
        ],
    )


@pytest.mark.asyncio
class TestRecords:
    async def test_anonymous(
        self, client: AsyncClient, save_fixture: SaveFixture, organization: Organization
    ) -> None:
        migration = await _create_migration(save_fixture, organization)
        response = await client.get(
            f"/v1/merchant-migrations/{migration.id}/records",
            params={"entity": "products"},
        )
        assert response.status_code == 401

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.organizations_write}))
    async def test_lists_classified_records(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        mocker: MockerFixture,
    ) -> None:
        migration = await build_connected_migration(save_fixture, organization)
        adapter = mocker.MagicMock()
        adapter.extract.return_value = _catalog_extract()
        adapter.get_source_account = mocker.AsyncMock(
            return_value=CanonicalAccount(country="US", is_connect_platform=False)
        )
        mocker.patch(
            "polar.merchant_migration.service.StripeAdapter", return_value=adapter
        )

        precheck = await client.post(f"/v1/merchant-migrations/{migration.id}/precheck")
        assert precheck.status_code == 200

        response = await client.get(
            f"/v1/merchant-migrations/{migration.id}/records",
            params={"entity": "products"},
        )
        assert response.status_code == 200
        json_body = response.json()
        assert json_body["pagination"]["total_count"] == 1
        assert json_body["items"][0]["source_id"] == "prod_1"
        assert json_body["items"][0]["status"] == "importable"


async def _catalog_with_customer_extract() -> AsyncIterator[CanonicalRecord]:
    async for record in _catalog_extract():
        yield record
    yield CanonicalCustomer(
        source_id="cus_1",
        email="alice@example.com",
        name="Alice",
        country="US",
    )


@pytest.mark.asyncio
class TestImport:
    async def test_anonymous(
        self, client: AsyncClient, save_fixture: SaveFixture, organization: Organization
    ) -> None:
        migration = await _create_migration(save_fixture, organization)
        response = await client.post(f"/v1/merchant-migrations/{migration.id}/import")
        assert response.status_code == 401

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.organizations_write}))
    async def test_precheck_required_returns_409(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        migration = await build_connected_migration(save_fixture, organization)
        response = await client.post(f"/v1/merchant-migrations/{migration.id}/import")
        assert response.status_code == 409

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.organizations_write}))
    async def test_imports_catalog(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        mocker: MockerFixture,
    ) -> None:
        migration = await build_connected_migration(save_fixture, organization)
        adapter = mocker.MagicMock()
        adapter.extract.return_value = _catalog_with_customer_extract()
        adapter.get_source_account = mocker.AsyncMock(
            return_value=CanonicalAccount(country="US", is_connect_platform=False)
        )
        mocker.patch(
            "polar.merchant_migration.service.StripeAdapter", return_value=adapter
        )

        precheck = await client.post(f"/v1/merchant-migrations/{migration.id}/precheck")
        assert precheck.status_code == 200

        response = await client.post(f"/v1/merchant-migrations/{migration.id}/import")
        assert response.status_code == 200
        json_body = response.json()
        assert json_body["step"] == "create_catalog"
        results = {result["entity"]: result for result in json_body["results"]}
        assert results["products"]["imported"] == 1
        assert results["customers"]["imported"] == 1

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.organizations_write}))
    async def test_imports_only_selected_records(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        mocker: MockerFixture,
    ) -> None:
        migration = await build_connected_migration(save_fixture, organization)
        adapter = mocker.MagicMock()
        adapter.extract.return_value = _catalog_with_customer_extract()
        adapter.get_source_account = mocker.AsyncMock(
            return_value=CanonicalAccount(country="US", is_connect_platform=False)
        )
        mocker.patch(
            "polar.merchant_migration.service.StripeAdapter", return_value=adapter
        )

        assert (
            await client.post(f"/v1/merchant-migrations/{migration.id}/precheck")
        ).status_code == 200

        # pick the customer row's ledger id from the records listing
        records = await client.get(
            f"/v1/merchant-migrations/{migration.id}/records",
            params={"entity": "customers"},
        )
        customer_record_id = records.json()["items"][0]["record_id"]
        assert customer_record_id is not None

        response = await client.post(
            f"/v1/merchant-migrations/{migration.id}/import",
            json={"record_ids": [customer_record_id]},
        )
        assert response.status_code == 200
        results = {r["entity"]: r for r in response.json()["results"]}
        # only the customer was selected; the product stays pending
        assert results["customers"]["imported"] == 1
        assert results["products"]["imported"] == 0


async def _create_migration(
    save_fixture: SaveFixture, organization: Organization
) -> MerchantMigration:
    migration = MerchantMigration(
        organization_id=organization.id,
        source_platform=MerchantMigrationSourcePlatform.stripe,
        step=MerchantMigrationStep.source_setup,
    )
    await save_fixture(migration)
    return migration
