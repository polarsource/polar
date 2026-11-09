from datetime import timedelta
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from polar.email.schemas import OrganizationEmailVerificationEmail
from polar.kit.utils import utc_now
from polar.models import Organization, OrganizationEmail
from polar.organization_email.repository import OrganizationEmailRepository
from polar.organization_email.service import (
    InvalidVerificationCode,
    OrganizationEmailMissing,
)
from polar.organization_email.service import (
    organization_email as organization_email_service,
)
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture

SUPPORT_EMAIL = "support@acme.com"


@pytest.fixture
async def organization_with_email(
    save_fixture: SaveFixture, organization: Organization
) -> Organization:
    organization.email = SUPPORT_EMAIL
    await save_fixture(organization)
    return organization


@pytest.fixture
def enqueue_email_mock(mocker: MockerFixture) -> MagicMock:
    return mocker.patch("polar.organization_email.service.enqueue_email_template")


def sent_code(enqueue_email_mock: MagicMock) -> str:
    email = enqueue_email_mock.call_args.args[0]
    assert isinstance(email, OrganizationEmailVerificationEmail)
    return email.props.code


@pytest.mark.anyio
class TestSendCode:
    async def test_no_email(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        with pytest.raises(OrganizationEmailMissing):
            await organization_email_service.send_code(session, organization)

    async def test_creates_row_and_sends_code(
        self,
        session: AsyncSession,
        organization_with_email: Organization,
        enqueue_email_mock: MagicMock,
    ) -> None:
        current = await organization_email_service.send_code(
            session, organization_with_email
        )

        assert current.email == SUPPORT_EMAIL
        assert current.code_hash is not None
        assert current.expires_at is not None
        assert current.verified_at is None
        assert len(sent_code(enqueue_email_mock)) == 6
        assert enqueue_email_mock.call_args.kwargs["to_email_addr"] == SUPPORT_EMAIL

    async def test_resend_reuses_row(
        self,
        session: AsyncSession,
        organization_with_email: Organization,
        enqueue_email_mock: MagicMock,
    ) -> None:
        first = await organization_email_service.send_code(
            session, organization_with_email
        )
        first_hash = first.code_hash
        second = await organization_email_service.send_code(
            session, organization_with_email
        )

        assert second.id == first.id
        assert second.code_hash != first_hash
        repository = OrganizationEmailRepository.from_session(session)
        assert (
            await repository.count(
                repository.get_statement_by_organization(organization_with_email.id)
            )
            == 1
        )

    async def test_already_verified(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization_with_email: Organization,
        enqueue_email_mock: MagicMock,
    ) -> None:
        verified = OrganizationEmail(
            organization=organization_with_email,
            email=SUPPORT_EMAIL,
            verified_at=utc_now(),
        )
        await save_fixture(verified)

        current = await organization_email_service.send_code(
            session, organization_with_email
        )

        assert current.id == verified.id
        assert current.verified_at is not None
        enqueue_email_mock.assert_not_called()


@pytest.mark.anyio
class TestVerify:
    async def test_valid(
        self,
        session: AsyncSession,
        organization_with_email: Organization,
        enqueue_email_mock: MagicMock,
    ) -> None:
        await organization_email_service.send_code(session, organization_with_email)
        code = sent_code(enqueue_email_mock)

        current = await organization_email_service.verify(
            session, organization_with_email, code.lower()
        )

        assert current.verified_at is not None
        assert current.code_hash is None
        assert current.expires_at is None
        assert await organization_email_service.is_verified(
            session, organization_with_email
        )

    async def test_wrong_code(
        self,
        session: AsyncSession,
        organization_with_email: Organization,
        enqueue_email_mock: MagicMock,
    ) -> None:
        await organization_email_service.send_code(session, organization_with_email)

        with pytest.raises(InvalidVerificationCode):
            await organization_email_service.verify(
                session, organization_with_email, "000000"
            )

    async def test_expired(
        self,
        session: AsyncSession,
        organization_with_email: Organization,
        enqueue_email_mock: MagicMock,
    ) -> None:
        current = await organization_email_service.send_code(
            session, organization_with_email
        )
        current.expires_at = utc_now() - timedelta(seconds=1)
        code = sent_code(enqueue_email_mock)

        with pytest.raises(InvalidVerificationCode):
            await organization_email_service.verify(
                session, organization_with_email, code
            )

    async def test_email_changed_since(
        self,
        session: AsyncSession,
        organization_with_email: Organization,
        enqueue_email_mock: MagicMock,
    ) -> None:
        await organization_email_service.send_code(session, organization_with_email)
        code = sent_code(enqueue_email_mock)
        organization_with_email.email = "other@acme.com"

        with pytest.raises(InvalidVerificationCode):
            await organization_email_service.verify(
                session, organization_with_email, code
            )

    async def test_no_code_requested(
        self, session: AsyncSession, organization_with_email: Organization
    ) -> None:
        with pytest.raises(InvalidVerificationCode):
            await organization_email_service.verify(
                session, organization_with_email, "ABC123"
            )


@pytest.mark.anyio
class TestIsVerified:
    async def test_no_row(
        self, session: AsyncSession, organization_with_email: Organization
    ) -> None:
        assert not await organization_email_service.is_verified(
            session, organization_with_email
        )

    async def test_verified_row_for_previous_email(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization_with_email: Organization,
    ) -> None:
        await save_fixture(
            OrganizationEmail(
                organization=organization_with_email,
                email="old@acme.com",
                verified_at=utc_now(),
            )
        )

        assert not await organization_email_service.is_verified(
            session, organization_with_email
        )
