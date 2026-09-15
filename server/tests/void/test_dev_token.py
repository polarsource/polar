from datetime import timedelta

import pytest
from pytest_mock import MockerFixture

from polar.auth.scope import Scope
from polar.config import Environment, settings
from polar.kit.crypto import get_token_hash
from polar.kit.utils import utc_now
from polar.models import Organization
from polar.organization_access_token.service import (
    TOKEN_PREFIX,
)
from polar.organization_access_token.service import (
    organization_access_token as organization_access_token_service,
)
from polar.postgres import AsyncSession
from scripts.generate_void_token import generate_void_token


@pytest.mark.asyncio
class TestGenerateVoidToken:
    @pytest.mark.parametrize("identifier", ["id", "slug"])
    @pytest.mark.parametrize("customers", [False, True])
    async def test_standard_organization_token(
        self,
        session: AsyncSession,
        organization: Organization,
        mocker: MockerFixture,
        identifier: str,
        customers: bool,
    ) -> None:
        mocker.patch.object(settings, "VOID_ENABLED", True)
        mocker.patch.object(settings, "VOID_ORGANIZATION_IDS", {organization.id})
        before = utc_now()
        token = await generate_void_token(
            session, str(getattr(organization, identifier)), customers=customers
        )
        stored = await organization_access_token_service.get_by_token(session, token)

        assert token.startswith(TOKEN_PREFIX)
        assert stored is not None
        assert stored.organization.id == organization.id
        expected_scopes = {Scope.void_read, Scope.void_write}
        if customers:
            expected_scopes.update({Scope.customers_read, Scope.customers_write})
        assert stored.scopes == expected_scopes
        assert stored.token == get_token_hash(token, secret=settings.SECRET)
        assert stored.token != token
        assert stored.expires_at is not None
        assert before + timedelta(hours=24) <= stored.expires_at
        assert stored.expires_at <= utc_now() + timedelta(hours=24)

    @pytest.mark.parametrize(
        "environment", [Environment.production, Environment.sandbox]
    )
    async def test_disallowed_environment(
        self,
        session: AsyncSession,
        mocker: MockerFixture,
        environment: Environment,
    ) -> None:
        mocker.patch.object(settings, "ENV", environment)
        with pytest.raises(ValueError, match="development or testing"):
            await generate_void_token(session, "acme")

    async def test_disabled(self, session: AsyncSession, mocker: MockerFixture) -> None:
        mocker.patch.object(settings, "VOID_ENABLED", False)
        with pytest.raises(ValueError, match="must be enabled"):
            await generate_void_token(session, "acme")

    async def test_not_allowlisted(
        self,
        session: AsyncSession,
        organization: Organization,
        mocker: MockerFixture,
    ) -> None:
        mocker.patch.object(settings, "VOID_ENABLED", True)
        mocker.patch.object(settings, "VOID_ORGANIZATION_IDS", set())
        with pytest.raises(ValueError, match="not allowlisted"):
            await generate_void_token(session, organization.slug)

    async def test_unknown_organization(
        self, session: AsyncSession, mocker: MockerFixture
    ) -> None:
        mocker.patch.object(settings, "VOID_ENABLED", True)
        with pytest.raises(ValueError, match="Organization not found"):
            await generate_void_token(session, "nonexistent-void-organization")

    async def test_organization_cannot_authenticate(
        self,
        session: AsyncSession,
        organization: Organization,
        mocker: MockerFixture,
    ) -> None:
        mocker.patch.object(settings, "VOID_ENABLED", True)
        mocker.patch.object(settings, "VOID_ORGANIZATION_IDS", {organization.id})
        organization.capabilities = {**organization.capabilities, "api_access": False}
        await session.flush()
        with pytest.raises(ValueError, match="cannot authenticate"):
            await generate_void_token(session, organization.slug)
