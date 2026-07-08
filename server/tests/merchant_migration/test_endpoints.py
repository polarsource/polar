from collections.abc import AsyncIterator
from urllib.parse import parse_qs, urlparse
from uuid import uuid4

import pytest
from httpx import AsyncClient
from pytest_mock import MockerFixture

from polar.auth.scope import Scope
from polar.config import settings
from polar.kit import jwt
from polar.merchant_migration.canonical import (
    CanonicalAccount,
    CanonicalPrice,
    CanonicalPricingScheme,
    CanonicalProduct,
    CanonicalRecord,
)
from polar.merchant_migration.repository import MerchantMigrationRepository
from polar.merchant_migration.stripe_oauth import StripeOAuthError
from polar.models import MerchantMigration, Organization, UserOrganization
from polar.models.merchant_migration import (
    MerchantMigrationSourcePlatform,
    MerchantMigrationStep,
)
from polar.postgres import AsyncSession
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.merchant_migration._helpers import build_stripe_oauth_token


def _configure_app(mocker: MockerFixture) -> None:
    mocker.patch.object(settings, "STRIPE_APP_CLIENT_ID", "ca_test")
    mocker.patch.object(settings, "STRIPE_APP_CLIENT_LINK_ID", "chnlink_test")


async def _enable_feature(
    save_fixture: SaveFixture, organization: Organization
) -> None:
    organization.feature_settings = {
        **organization.feature_settings,
        "merchant_migration_enabled": True,
    }
    await save_fixture(organization)


def _state_migration_id(location: str) -> str:
    state = parse_qs(urlparse(location).query)["state"][0]
    return jwt.decode(token=state, secret=settings.SECRET, type="stripe_app_oauth")[
        "migration_id"
    ]


@pytest.mark.asyncio
class TestCreate:
    async def test_anonymous(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.post(
            "/v1/merchant-migrations/",
            json={"organization_id": str(organization.id), "source_platform": "stripe"},
        )
        assert response.status_code == 401

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.organizations_write}))
    async def test_not_member_returns_403(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.post(
            "/v1/merchant-migrations/",
            json={"organization_id": str(organization.id), "source_platform": "stripe"},
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
            "/v1/merchant-migrations/",
            json={"organization_id": str(organization.id), "source_platform": "stripe"},
        )
        assert response.status_code == 403

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.organizations_write}))
    async def test_creates_multiple_migrations(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        await _enable_feature(save_fixture, organization)

        first = await client.post(
            "/v1/merchant-migrations/",
            json={"organization_id": str(organization.id), "source_platform": "stripe"},
        )
        assert first.status_code == 201
        body = first.json()
        assert body["source_platform"] == "stripe"
        assert body["step"] == "source_setup"
        assert body["source_connected"] is False
        assert "source_credentials" not in body

        second = await client.post(
            "/v1/merchant-migrations/",
            json={"organization_id": str(organization.id), "source_platform": "stripe"},
        )
        assert second.status_code == 201
        assert second.json()["id"] != body["id"]

        repository = MerchantMigrationRepository.from_session(session)
        migrations = await repository.get_all(
            repository.get_base_statement().where(
                MerchantMigration.organization_id == organization.id
            )
        )
        assert len(migrations) == 2


@pytest.mark.asyncio
class TestStripeAuthorize:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get(
            "/v1/merchant-migrations/stripe/authorize",
            params={"migration_id": str(uuid4()), "return_to": "/dashboard"},
        )
        assert response.status_code == 401

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.organizations_write}))
    async def test_not_member_returns_404(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        mocker: MockerFixture,
    ) -> None:
        _configure_app(mocker)
        migration = await _create_migration(save_fixture, organization)
        response = await client.get(
            "/v1/merchant-migrations/stripe/authorize",
            params={"migration_id": str(migration.id), "return_to": "/dashboard"},
        )
        assert response.status_code == 404

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.organizations_write}))
    async def test_redirects_to_stripe(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        mocker: MockerFixture,
    ) -> None:
        _configure_app(mocker)
        migration = await _create_migration(save_fixture, organization)
        response = await client.get(
            "/v1/merchant-migrations/stripe/authorize",
            params={"migration_id": str(migration.id), "return_to": "/dashboard"},
        )
        assert response.status_code == 303
        location = response.headers["location"]
        assert location.startswith(
            "https://marketplace.stripe.com/oauth/v2/chnlink_test/authorize"
        )
        assert "ca_test" in location
        assert _state_migration_id(location) == str(migration.id)


@pytest.mark.asyncio
class TestStripeCallback:
    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.organizations_write}))
    async def test_valid_stores_credentials_and_redirects(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        mocker: MockerFixture,
    ) -> None:
        _configure_app(mocker)
        migration = await _create_migration(save_fixture, organization)
        mocker.patch(
            "polar.merchant_migration.service.stripe_oauth.exchange_code",
            return_value=build_stripe_oauth_token(),
        )

        authorize = await client.get(
            "/v1/merchant-migrations/stripe/authorize",
            params={"migration_id": str(migration.id), "return_to": "/dashboard"},
        )
        state = parse_qs(urlparse(authorize.headers["location"]).query)["state"][0]

        response = await client.get(
            "/v1/merchant-migrations/stripe/callback",
            params={"state": state, "code": "ac_test"},
        )
        assert response.status_code == 303
        assert response.headers["location"].endswith("/dashboard")

        repository = MerchantMigrationRepository.from_session(session)
        stored = await repository.get_by_id(migration.id)
        assert stored is not None
        assert stored.source_credentials["stripe_user_id"] == "acct_test"
        # the refresh token is stored as ciphertext, never in clear text
        assert stored.source_credentials["refresh_token_encrypted"].startswith("v1.")

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.organizations_write}))
    async def test_missing_code_redirects_with_error(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        mocker: MockerFixture,
    ) -> None:
        _configure_app(mocker)
        migration = await _create_migration(save_fixture, organization)
        authorize = await client.get(
            "/v1/merchant-migrations/stripe/authorize",
            params={"migration_id": str(migration.id), "return_to": "/dashboard"},
        )
        state = parse_qs(urlparse(authorize.headers["location"]).query)["state"][0]

        response = await client.get(
            "/v1/merchant-migrations/stripe/callback",
            params={"state": state, "error": "access_denied"},
        )
        assert response.status_code == 303
        assert "error=" in response.headers["location"]

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.organizations_write}))
    async def test_exchange_failure_redirects_with_error(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        mocker: MockerFixture,
    ) -> None:
        _configure_app(mocker)
        migration = await _create_migration(save_fixture, organization)
        mocker.patch(
            "polar.merchant_migration.service.stripe_oauth.exchange_code",
            side_effect=StripeOAuthError("stripe down", 502),
        )
        authorize = await client.get(
            "/v1/merchant-migrations/stripe/authorize",
            params={"migration_id": str(migration.id), "return_to": "/dashboard"},
        )
        state = parse_qs(urlparse(authorize.headers["location"]).query)["state"][0]

        response = await client.get(
            "/v1/merchant-migrations/stripe/callback",
            params={"state": state, "code": "ac_test"},
        )
        assert response.status_code == 303
        assert "error=" in response.headers["location"]

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.organizations_write}))
    async def test_invalid_state_returns_400(self, client: AsyncClient) -> None:
        response = await client.get(
            "/v1/merchant-migrations/stripe/callback",
            params={"state": "not-a-jwt", "code": "ac_test"},
        )
        assert response.status_code == 400


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
        assert item["source_connected"] is False
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
        _configure_app(mocker)
        migration = await _create_migration(save_fixture, organization)
        mocker.patch(
            "polar.merchant_migration.service.stripe_oauth.exchange_code",
            return_value=build_stripe_oauth_token(),
        )
        mocker.patch(
            "polar.merchant_migration.service.stripe_oauth.refresh",
            return_value=build_stripe_oauth_token("rt_new"),
        )
        adapter = mocker.MagicMock()
        adapter.extract.return_value = _empty_extract()
        adapter.get_source_account = mocker.AsyncMock(
            return_value=CanonicalAccount(country="US", is_connect_platform=False)
        )
        mocker.patch(
            "polar.merchant_migration.service.StripeAdapter", return_value=adapter
        )

        authorize = await client.get(
            "/v1/merchant-migrations/stripe/authorize",
            params={"migration_id": str(migration.id), "return_to": "/dashboard"},
        )
        state = parse_qs(urlparse(authorize.headers["location"]).query)["state"][0]
        await client.get(
            "/v1/merchant-migrations/stripe/callback",
            params={"state": state, "code": "ac_test"},
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
        _configure_app(mocker)
        migration = await _create_migration(save_fixture, organization)
        mocker.patch(
            "polar.merchant_migration.service.stripe_oauth.exchange_code",
            return_value=build_stripe_oauth_token(),
        )
        mocker.patch(
            "polar.merchant_migration.service.stripe_oauth.refresh",
            return_value=build_stripe_oauth_token("rt_new"),
        )
        adapter = mocker.MagicMock()
        adapter.extract.return_value = _catalog_extract()
        adapter.get_source_account = mocker.AsyncMock(
            return_value=CanonicalAccount(country="US", is_connect_platform=False)
        )
        mocker.patch(
            "polar.merchant_migration.service.StripeAdapter", return_value=adapter
        )

        authorize = await client.get(
            "/v1/merchant-migrations/stripe/authorize",
            params={"migration_id": str(migration.id), "return_to": "/dashboard"},
        )
        state = parse_qs(urlparse(authorize.headers["location"]).query)["state"][0]
        await client.get(
            "/v1/merchant-migrations/stripe/callback",
            params={"state": state, "code": "ac_test"},
        )

        precheck = await client.post(
            f"/v1/merchant-migrations/{migration.id}/precheck"
        )
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
