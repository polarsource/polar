import argparse
import shlex
from datetime import timedelta
from pathlib import Path
from stat import S_IMODE

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select

from polar.auth.scope import Scope
from polar.config import Environment, settings
from polar.kit.utils import utc_now
from polar.models import Account, Organization, User, UserOrganization
from polar.models.organization import OrganizationStatus
from polar.models.user_organization import OrganizationRole
from polar.oauth2.service.oauth2_client import (
    oauth2_client as oauth2_client_service,
)
from polar.oauth2.void_cli_client import CLIENT_IDS, REDIRECT_URI, ensure_client
from polar.organization_access_token.service import (
    organization_access_token as organization_access_token_service,
)
from polar.postgres import AsyncSession
from polar.void.development.service import (
    ACCOUNT_ID,
    OPERATOR_EMAIL,
    ORGANIZATION_ID,
    ORGANIZATION_SLUG,
    DevelopmentSeedConflict,
)
from polar.void.development.service import development as development_service
from polar.void.schemas import VoidOrganization
from scripts.seed_void import api_origin, seed_token, write_environment


@pytest.mark.asyncio
class TestDevelopmentSeed:
    async def test_seed_token_reads_current_organization(
        self,
        session: AsyncSession,
        void_client: AsyncClient,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        organization_id, token, _ = await seed_token(session)
        response = await void_client.get(
            "/v1/void/organizations/current",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200, response.text
        organization = VoidOrganization.model_validate(response.json())
        assert organization.id == ORGANIZATION_ID
        assert organization.slug == ORGANIZATION_SLUG
        assert ORGANIZATION_ID.version == ACCOUNT_ID.version == 4

    async def test_seed_adds_operator_as_admin(
        self,
        session: AsyncSession,
    ) -> None:
        organization, created = await development_service.seed(session)
        assert created
        user = await session.scalar(select(User).where(User.email == OPERATOR_EMAIL))
        assert user is not None
        membership = await session.scalar(
            select(UserOrganization).where(
                UserOrganization.user_id == user.id,
                UserOrganization.organization_id == organization.id,
            )
        )
        assert membership is not None
        assert membership.role == OrganizationRole.admin
        _, repeated = await development_service.seed(session)
        assert not repeated
        assert (
            await session.scalar(
                select(func.count())
                .select_from(UserOrganization)
                .where(UserOrganization.organization_id == organization.id)
            )
            == 1
        )

    async def test_repeat_reuses_organization_and_issues_scoped_tokens(
        self,
        session: AsyncSession,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        before = utc_now()
        first_id, first_token, created = await seed_token(session)
        second_id, second_token, repeated_created = await seed_token(session)
        assert created
        assert not repeated_created
        assert first_id == second_id == ORGANIZATION_ID
        assert first_token != second_token
        assert (
            await session.scalar(
                select(func.count())
                .select_from(Organization)
                .where(Organization.id == ORGANIZATION_ID)
            )
            == 1
        )
        assert (
            await session.scalar(
                select(func.count())
                .select_from(Account)
                .where(Account.id == ACCOUNT_ID)
            )
            == 1
        )
        token = await organization_access_token_service.get_by_token(
            session, second_token
        )
        assert token is not None
        assert token.scopes == {
            Scope.void_read,
            Scope.void_write,
            Scope.customers_read,
            Scope.customers_write,
        }
        assert token.expires_at is not None
        assert (
            before + timedelta(hours=24)
            <= token.expires_at
            <= utc_now() + timedelta(hours=24)
        )
        assert token.organization.account_id == ACCOUNT_ID
        assert token.organization.status == OrganizationStatus.ACTIVE
        assert token.organization.is_void_enabled

    async def test_seed_token_upserts_void_cli_oauth_client(
        self,
        session: AsyncSession,
    ) -> None:
        await seed_token(session)
        client = await oauth2_client_service.get_by_client_id(
            session, CLIENT_IDS["local"]
        )
        assert client is not None
        assert client.first_party is False
        assert client.client_name == "Void CLI"
        assert REDIRECT_URI in client.redirect_uris
        assert client.token_endpoint_auth_method == "none"
        assert client.default_sub_type.value == "organization"
        assert "void:write" in client.client_metadata["scope"]
        again, created = await ensure_client(session)
        assert again.id == client.id
        assert created is False

    @pytest.mark.parametrize("change", ["slug", "status", "capabilities", "deleted"])
    async def test_preserves_incompatible_existing_organization(
        self,
        session: AsyncSession,
        change: str,
    ) -> None:
        organization, _ = await development_service.seed(session)
        if change == "slug":
            organization.slug = "renamed"
        elif change == "status":
            organization.status = OrganizationStatus.BLOCKED
        elif change == "capabilities":
            organization.capabilities = {
                **organization.capabilities,
                "api_access": False,
            }
        else:
            organization.deleted_at = utc_now()
        await session.flush()
        previous = (
            organization.slug,
            organization.status,
            dict(organization.capabilities),
            organization.deleted_at,
        )
        with pytest.raises(DevelopmentSeedConflict):
            await development_service.seed(session)
        assert (
            organization.slug,
            organization.status,
            organization.capabilities,
            organization.deleted_at,
        ) == previous

    async def test_does_not_claim_an_unrelated_organization_slug(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        organization.slug = ORGANIZATION_SLUG
        await session.flush()
        original_id = organization.id
        with pytest.raises(DevelopmentSeedConflict):
            await development_service.seed(session)
        assert organization.id == original_id
        assert await session.get(Account, ACCOUNT_ID) is None
        assert await session.get(Organization, ORGANIZATION_ID) is None

    @pytest.mark.parametrize(
        "environment", [Environment.production, Environment.sandbox]
    )
    async def test_refuses_nonlocal_environments(
        self,
        session: AsyncSession,
        monkeypatch: pytest.MonkeyPatch,
        environment: Environment,
    ) -> None:
        monkeypatch.setattr(settings, "ENV", environment)
        with pytest.raises(ValueError, match="development or testing"):
            await development_service.seed(session)
        assert await session.get(Organization, ORGANIZATION_ID) is None


class TestCredentialFile:
    def test_atomic_replacement_is_private_and_sourceable(self, tmp_path: Path) -> None:
        output = tmp_path / "credentials" / "void.env"
        write_environment(output, "first-secret", "http://127.0.0.1:8000")
        output.chmod(0o644)
        write_environment(output, "new'secret$", "http://127.0.0.1:9001")
        assert S_IMODE(output.stat().st_mode) == 0o600
        values = dict(
            shlex.split(line)[1].split("=", 1)
            for line in output.read_text().splitlines()
        )
        assert values == {
            "VOID_TOKEN": "new'secret$",
            "VOID_API_URL": "http://127.0.0.1:9001",
        }
        assert list(output.parent.iterdir()) == [output]

    def test_api_url_is_an_origin(self) -> None:
        assert api_origin("http://localhost:8000/") == "http://localhost:8000"
        with pytest.raises(argparse.ArgumentTypeError, match="origin"):
            api_origin("http://localhost:8000/v1/void")
