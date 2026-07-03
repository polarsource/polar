from collections.abc import AsyncIterator
from urllib.parse import parse_qs, urlparse
from uuid import uuid4

import pytest
from httpx import AsyncClient
from pytest_mock import MockerFixture

from polar.auth.scope import Scope
from polar.config import settings
from polar.merchant_migration.canonical import CanonicalAccount
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


@pytest.mark.asyncio
class TestStripeAuthorize:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get(
            "/v1/merchant-migrations/stripe/authorize",
            params={"organization_id": str(uuid4()), "return_to": "/dashboard"},
        )
        assert response.status_code == 401

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.organizations_write}))
    async def test_not_member_returns_403(
        self, client: AsyncClient, organization: Organization, mocker: MockerFixture
    ) -> None:
        _configure_app(mocker)
        response = await client.get(
            "/v1/merchant-migrations/stripe/authorize",
            params={"organization_id": str(organization.id), "return_to": "/dashboard"},
        )
        assert response.status_code == 403

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.organizations_write}))
    async def test_redirects_to_stripe(
        self,
        client: AsyncClient,
        session: AsyncSession,
        organization: Organization,
        user_organization: UserOrganization,
        mocker: MockerFixture,
    ) -> None:
        _configure_app(mocker)
        response = await client.get(
            "/v1/merchant-migrations/stripe/authorize",
            params={"organization_id": str(organization.id), "return_to": "/dashboard"},
        )
        assert response.status_code == 303
        location = response.headers["location"]
        assert location.startswith(
            "https://marketplace.stripe.com/oauth/v2/chnlink_test/authorize"
        )
        assert "ca_test" in location

        repository = MerchantMigrationRepository.from_session(session)
        migration = await repository.get_ongoing_by_source(
            organization.id, MerchantMigrationSourcePlatform.stripe
        )
        assert migration is not None


@pytest.mark.asyncio
class TestStripeCallback:
    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.organizations_write}))
    async def test_valid_stores_credentials_and_redirects(
        self,
        client: AsyncClient,
        session: AsyncSession,
        organization: Organization,
        user_organization: UserOrganization,
        mocker: MockerFixture,
    ) -> None:
        _configure_app(mocker)
        mocker.patch(
            "polar.merchant_migration.service.stripe_oauth.exchange_code",
            return_value=build_stripe_oauth_token(),
        )

        authorize = await client.get(
            "/v1/merchant-migrations/stripe/authorize",
            params={"organization_id": str(organization.id), "return_to": "/dashboard"},
        )
        state = parse_qs(urlparse(authorize.headers["location"]).query)["state"][0]

        response = await client.get(
            "/v1/merchant-migrations/stripe/callback",
            params={"state": state, "code": "ac_test"},
        )
        assert response.status_code == 303
        assert response.headers["location"].endswith("/dashboard")

        repository = MerchantMigrationRepository.from_session(session)
        migration = await repository.get_ongoing_by_source(
            organization.id, MerchantMigrationSourcePlatform.stripe
        )
        assert migration is not None
        assert migration.source_credentials["stripe_user_id"] == "acct_test"
        # the refresh token is stored as ciphertext, never in clear text
        assert migration.source_credentials["refresh_token_encrypted"].startswith("v1.")

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.organizations_write}))
    async def test_missing_code_redirects_with_error(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
        mocker: MockerFixture,
    ) -> None:
        _configure_app(mocker)
        authorize = await client.get(
            "/v1/merchant-migrations/stripe/authorize",
            params={"organization_id": str(organization.id), "return_to": "/dashboard"},
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
        organization: Organization,
        user_organization: UserOrganization,
        mocker: MockerFixture,
    ) -> None:
        _configure_app(mocker)
        mocker.patch(
            "polar.merchant_migration.service.stripe_oauth.exchange_code",
            side_effect=StripeOAuthError("stripe down", 502),
        )
        authorize = await client.get(
            "/v1/merchant-migrations/stripe/authorize",
            params={"organization_id": str(organization.id), "return_to": "/dashboard"},
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
        organization: Organization,
        user_organization: UserOrganization,
        mocker: MockerFixture,
    ) -> None:
        _configure_app(mocker)
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
            params={"organization_id": str(organization.id), "return_to": "/dashboard"},
        )
        state = parse_qs(urlparse(authorize.headers["location"]).query)["state"][0]
        await client.get(
            "/v1/merchant-migrations/stripe/callback",
            params={"state": state, "code": "ac_test"},
        )

        repository = MerchantMigrationRepository.from_session(session)
        migration = await repository.get_ongoing_by_source(
            organization.id, MerchantMigrationSourcePlatform.stripe
        )
        assert migration is not None

        response = await client.post(f"/v1/merchant-migrations/{migration.id}/precheck")
        assert response.status_code == 200
        json_body = response.json()
        assert json_body["can_start"] is True
        assert json_body["issues"] == []


async def _empty_extract() -> AsyncIterator[object]:
    return
    yield


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
