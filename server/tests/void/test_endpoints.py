import time
from datetime import timedelta

import pytest
from httpx import AsyncClient

from polar.auth.scope import Scope
from polar.config import settings
from polar.kit.crypto import get_token_hash
from polar.kit.utils import utc_now
from polar.kit.versioning import VERSION_HEADER, APIVersion
from polar.models import OAuth2Token, Organization, OrganizationAccessToken
from polar.oauth2.constants import ACCESS_TOKEN_PREFIX
from polar.oauth2.sub_type import SubType
from polar.organization_access_token.service import TOKEN_PREFIX
from polar.postgres import AsyncSession
from polar.version import CURRENT_API_VERSION, VERSIONS
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture

PATH = "/v1/void/organizations/current"
TOKEN = f"{TOKEN_PREFIX}void_test"


pytestmark = pytest.mark.usefixtures("enable_void")


async def create_token(
    save_fixture: SaveFixture,
    organization: Organization,
    *,
    scopes: set[Scope] | None = None,
    token: str = TOKEN,
) -> OrganizationAccessToken:
    access_token = OrganizationAccessToken(
        organization=organization,
        token=get_token_hash(token, secret=settings.SECRET),
        scope=" ".join(
            scope.value
            for scope in (scopes if scopes is not None else {Scope.void_read})
        ),
        comment="Void test",
        expires_at=None,
    )
    await save_fixture(access_token)
    return access_token


@pytest.mark.asyncio
class TestCurrentOrganization:
    @pytest.mark.parametrize("scope", [Scope.void_read, Scope.void_write])
    @pytest.mark.parametrize("version", [None, *sorted(VERSIONS)])
    async def test_valid(
        self,
        void_client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        scope: Scope,
        version: APIVersion | None,
    ) -> None:
        await create_token(save_fixture, organization, scopes={scope})
        headers = {"Authorization": f"Bearer {TOKEN}"}
        if version is not None:
            headers[VERSION_HEADER] = str(version)

        response = await void_client.get(PATH, headers=headers)

        assert response.status_code == 200
        data = response.json()
        assert set(data) == {"id", "name", "slug", "created_at", "default_variant_id"}
        assert data["id"] == str(organization.id)
        assert data["name"] == organization.name
        assert data["slug"] == organization.slug
        assert data["created_at"] == organization.created_at.isoformat().replace(
            "+00:00", "Z"
        )
        assert response.headers[VERSION_HEADER] == str(version or CURRENT_API_VERSION)

    async def test_disabled(
        self,
        void_client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        await create_token(save_fixture, organization)
        monkeypatch.setattr(settings, "VOID_ENABLED", False)

        response = await void_client.get(
            PATH, headers={"Authorization": f"Bearer {TOKEN}"}
        )

        assert response.status_code == 404

    async def test_organization_feature_disabled(
        self,
        void_client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        await create_token(save_fixture, organization)
        organization.feature_settings = {
            **organization.feature_settings,
            "void_enabled": False,
        }
        await save_fixture(organization)

        response = await void_client.get(
            PATH, headers={"Authorization": f"Bearer {TOKEN}"}
        )

        assert response.status_code == 404

    async def test_database_flag_changes_apply_to_existing_token(
        self,
        void_client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        session: AsyncSession,
    ) -> None:
        await create_token(save_fixture, organization)
        for enabled in (True, False, True):
            organization.feature_settings = {
                **organization.feature_settings,
                "void_enabled": enabled,
            }
            await session.merge(organization)
            await session.flush()
            response = await void_client.get(
                PATH, headers={"Authorization": f"Bearer {TOKEN}"}
            )
            assert response.status_code == (200 if enabled else 404)

    async def test_other_organization_cannot_select_enabled_organization(
        self,
        void_client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        organization_second: Organization,
    ) -> None:
        await create_token(save_fixture, organization_second)

        response = await void_client.get(
            PATH,
            params={"organization_id": str(organization.id)},
            headers={"Authorization": f"Bearer {TOKEN}"},
        )

        assert response.status_code == 404

    async def test_current_organization_is_always_the_token_owner(
        self,
        void_client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        organization_second: Organization,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        organization_second.feature_settings = {
            **organization_second.feature_settings,
            "void_enabled": True,
        }
        await save_fixture(organization_second)
        await create_token(save_fixture, organization)
        second_token = f"{TOKEN_PREFIX}second_void_test"
        await create_token(save_fixture, organization_second, token=second_token)

        for token, owner in [
            (TOKEN, organization),
            (second_token, organization_second),
        ]:
            response = await void_client.get(
                PATH,
                params={"organization_id": str(organization.id)},
                headers={"Authorization": f"Bearer {token}"},
            )
            assert response.status_code == 200
            assert response.json()["id"] == str(owner.id)

    async def test_anonymous(self, void_client: AsyncClient) -> None:
        response = await void_client.get(PATH)

        assert response.status_code == 401

    @pytest.mark.parametrize("token", [TOKEN, "invalid", "void_legacy_token"])
    async def test_invalid_token(self, void_client: AsyncClient, token: str) -> None:
        response = await void_client.get(
            PATH, headers={"Authorization": f"Bearer {token}"}
        )

        assert response.status_code == 401

    @pytest.mark.parametrize("state", ["revoked", "expired"])
    async def test_unusable_token(
        self,
        void_client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        state: str,
    ) -> None:
        token = await create_token(save_fixture, organization)
        if state == "revoked":
            token.deleted_at = utc_now()
        else:
            token.expires_at = utc_now() - timedelta(seconds=1)
        await save_fixture(token)

        response = await void_client.get(
            PATH, headers={"Authorization": f"Bearer {TOKEN}"}
        )

        assert response.status_code == 401

    async def test_insufficient_scope(
        self,
        void_client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        await create_token(
            save_fixture, organization, scopes={Scope.organizations_read}
        )

        response = await void_client.get(
            PATH, headers={"Authorization": f"Bearer {TOKEN}"}
        )

        assert response.status_code == 403

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user", scopes={Scope.void_read}),
        AuthSubjectFixture(subject="customer", scopes={Scope.void_read}),
        AuthSubjectFixture(subject="organization", scopes={Scope.void_read}),
    )
    async def test_wrong_subject_or_missing_token_session(
        self, client: AsyncClient
    ) -> None:
        response = await client.get(PATH)

        assert response.status_code == 401

    async def test_organization_oauth_token_rejected(
        self,
        void_client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        token = f"{ACCESS_TOKEN_PREFIX[SubType.organization]}void_test"
        await save_fixture(
            OAuth2Token(
                client_id="polar_ci_test",
                token_type="bearer",
                access_token=get_token_hash(token, secret=settings.SECRET),
                scope=Scope.void_read.value,
                issued_at=int(time.time()),
                expires_in=3600,
                organization=organization,
                sub_type=SubType.organization,
            )
        )

        response = await void_client.get(
            PATH, headers={"Authorization": f"Bearer {token}"}
        )

        assert response.status_code == 401
