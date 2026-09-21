from unittest.mock import MagicMock

import pytest
from reauth.factors.backup_codes import (
    AlreadyUsedBackupCodeException,
    InvalidBackupCodeException,
)

from polar.auth.factors import BackupCodesFactor, get_org_factors
from polar.auth.oauth2.state import OAuth2StateService
from polar.config import settings
from polar.exceptions import ResourceNotFound
from polar.kit.crypto import get_token_hash_candidates
from polar.models import (
    BackupCodesEnrollment,
    Organization,
    OrganizationSSOConnection,
    User,
)
from polar.models.organization_sso_connection import (
    OIDCAuthMethod,
    OIDCConfiguration,
    OrganizationSSOConnectionType,
)
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture


async def enable_sso(
    save_fixture: SaveFixture, organization: Organization, *, enabled: bool = True
) -> None:
    organization.feature_settings = {
        **organization.feature_settings,
        "sso_enabled": enabled,
    }
    await save_fixture(organization)


async def create_sso_connection(
    save_fixture: SaveFixture,
    organization: Organization,
    *,
    enabled: bool,
) -> OrganizationSSOConnection:
    configuration: OIDCConfiguration = {
        "issuer": "https://idp.example.com",
        "client_id": "client-id",
        "auth_method": OIDCAuthMethod.client_secret,
        "client_secret": "secret",
    }
    connection = OrganizationSSOConnection(
        organization=organization,
        type=OrganizationSSOConnectionType.oidc,
        configuration=configuration,
        enabled=enabled,
    )
    await save_fixture(connection)
    return connection


@pytest.mark.asyncio
class TestGetOrgFactors:
    async def test_unknown_slug(self, session: AsyncSession) -> None:
        with pytest.raises(ResourceNotFound):
            await get_org_factors(
                slug="does-not-exist",
                base_factors=set(),
                session=session,
                state_service=OAuth2StateService(session),
            )

    async def test_only_enabled_connections_become_factors(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        await enable_sso(save_fixture, organization)
        enabled = await create_sso_connection(save_fixture, organization, enabled=True)
        await create_sso_connection(save_fixture, organization, enabled=False)

        factors = await get_org_factors(
            slug=organization.slug,
            base_factors=set(),
            session=session,
            state_service=OAuth2StateService(session),
        )

        assert {factor.identifier for factor in factors} == {str(enabled.id)}

    async def test_offers_base_factors_when_not_enforced(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        await enable_sso(save_fixture, organization)
        connection = await create_sso_connection(
            save_fixture, organization, enabled=True
        )
        base_factor = MagicMock()

        factors = await get_org_factors(
            slug=organization.slug,
            base_factors={base_factor},
            session=session,
            state_service=OAuth2StateService(session),
        )

        assert base_factor in factors
        assert any(
            factor.identifier == str(connection.id)
            for factor in factors
            if factor is not base_factor
        )

    async def test_excludes_base_factors_when_enforced(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        await enable_sso(save_fixture, organization)
        connection = await create_sso_connection(
            save_fixture, organization, enabled=True
        )
        organization.sso_enforced = True
        await save_fixture(organization)
        base_factor = MagicMock()

        factors = await get_org_factors(
            slug=organization.slug,
            base_factors={base_factor},
            session=session,
            state_service=OAuth2StateService(session),
        )

        assert base_factor not in factors
        assert {factor.identifier for factor in factors} == {str(connection.id)}

    async def test_no_sso_factors_when_feature_disabled(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        await create_sso_connection(save_fixture, organization, enabled=True)
        base_factor = MagicMock()

        factors = await get_org_factors(
            slug=organization.slug,
            base_factors={base_factor},
            session=session,
            state_service=OAuth2StateService(session),
        )

        assert factors == {base_factor}


@pytest.mark.asyncio
class TestBackupCodesFactorVerify:
    @pytest.fixture
    def rotated(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr(
            settings, "HASH_SECRETS", {"k1": "retired", "k2": "current"}
        )
        monkeypatch.setattr(settings, "CURRENT_HASH_SECRET_ID", "k2")

    async def _enroll_under(
        self,
        save_fixture: SaveFixture,
        user: User,
        secret_id: str,
        codes: list[str],
        monkeypatch: pytest.MonkeyPatch,
    ) -> BackupCodesEnrollment:
        monkeypatch.setattr(settings, "CURRENT_HASH_SECRET_ID", secret_id)
        hashes = [get_token_hash_candidates(code)[secret_id] for code in codes]
        monkeypatch.setattr(settings, "CURRENT_HASH_SECRET_ID", "k2")
        enrollment = BackupCodesEnrollment(
            identity_id=user.id, codes_hashes=hashes, used_codes_hashes=[]
        )
        await save_fixture(enrollment)
        return enrollment

    async def test_accepts_a_code_hashed_under_a_retired_secret(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        user: User,
        rotated: None,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        enrollment = await self._enroll_under(
            save_fixture, user, "k1", ["AAAAAAAAAA", "BBBBBBBBBB"], monkeypatch
        )

        factor = BackupCodesFactor(session)
        verified = await factor.verify(user.id, "AAAAAAAAAA")

        current = get_token_hash_candidates("AAAAAAAAAA")["k2"]
        assert current in verified.codes_hashes
        assert verified.used_codes_hashes == [current]

        await session.refresh(enrollment)
        assert current in enrollment.codes_hashes
        assert enrollment.used_codes_hashes == [current]

    async def test_leaves_the_other_codes_under_their_secret(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        user: User,
        rotated: None,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        enrollment = await self._enroll_under(
            save_fixture, user, "k1", ["AAAAAAAAAA", "BBBBBBBBBB"], monkeypatch
        )

        factor = BackupCodesFactor(session)
        await factor.verify(user.id, "AAAAAAAAAA")

        await session.refresh(enrollment)
        assert get_token_hash_candidates("BBBBBBBBBB")["k1"] in enrollment.codes_hashes

    async def test_rejects_an_unknown_code(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        user: User,
        rotated: None,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        await self._enroll_under(save_fixture, user, "k1", ["AAAAAAAAAA"], monkeypatch)

        factor = BackupCodesFactor(session)
        with pytest.raises(InvalidBackupCodeException):
            await factor.verify(user.id, "ZZZZZZZZZZ")

    async def test_rejects_a_code_already_used_under_a_retired_secret(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        user: User,
        rotated: None,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        enrollment = await self._enroll_under(
            save_fixture, user, "k1", ["AAAAAAAAAA"], monkeypatch
        )
        enrollment.used_codes_hashes = list(enrollment.codes_hashes)
        await save_fixture(enrollment)

        factor = BackupCodesFactor(session)
        with pytest.raises(AlreadyUsedBackupCodeException):
            await factor.verify(user.id, "AAAAAAAAAA")
