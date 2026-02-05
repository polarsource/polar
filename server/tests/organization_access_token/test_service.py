from datetime import timedelta
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from polar.config import settings
from polar.enums import TokenType
from polar.kit.crypto import get_token_hash
from polar.kit.utils import utc_now
from polar.models import Organization, OrganizationAccessToken, UserOrganization
from polar.organization_access_token.service import (
    organization_access_token as organization_access_token_service,
)
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture


@pytest.fixture(autouse=True)
def enqueue_email_mock(mocker: MockerFixture) -> MagicMock:
    return mocker.patch(
        "polar.organization_access_token.service.enqueue_email", autospec=True
    )


@pytest.mark.asyncio
class TestRevokeLeaked:
    async def test_false_positive(
        self, session: AsyncSession, enqueue_email_mock: MagicMock
    ) -> None:
        result = await organization_access_token_service.revoke_leaked(
            session,
            "spaire_pat_123",
            TokenType.organization_access_token,
            notifier="github",
            url="https://github.com",
        )
        assert result is False

        enqueue_email_mock.assert_not_called()

    async def test_true_positive(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        user_organization: UserOrganization,
        enqueue_email_mock: MagicMock,
    ) -> None:
        token_hash = get_token_hash("spaire_pat_123", secret=settings.SECRET)
        organization_access_token = OrganizationAccessToken(
            comment="Test",
            token=token_hash,
            organization=organization,
            expires_at=utc_now() + timedelta(days=1),
            scope="openid",
        )
        await save_fixture(organization_access_token)

        result = await organization_access_token_service.revoke_leaked(
            session,
            "spaire_pat_123",
            TokenType.organization_access_token,
            notifier="github",
            url="https://github.com",
        )
        assert result is True

        updated_organization_access_token = await session.get(
            OrganizationAccessToken, organization_access_token.id
        )
        assert updated_organization_access_token is not None
        assert updated_organization_access_token.deleted_at is not None

        enqueue_email_mock.assert_called_once()
