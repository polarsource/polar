import pytest

from polar.auth.factors import EmailOTPFactor
from polar.kit.utils import utc_now
from polar.models import AuthenticationSession, EmailOTP
from polar.postgres import AsyncSession
from scripts.dev_login_code import issue_login_code
from tests.fixtures.database import SaveFixture


async def create_pending_sign_in(
    save_fixture: SaveFixture, *, email: str, code_hash: str, expires_in: int
) -> EmailOTP:
    expires_at = int(utc_now().timestamp()) + expires_in
    authentication_session = AuthenticationSession(
        token_hash=code_hash,
        expires_at=expires_at,
        step=0,
        authentication_method_references=[],
        used_factors=[],
        context=None,
        identity_id=None,
    )
    await save_fixture(authentication_session)
    email_otp = EmailOTP(
        code_hash=code_hash,
        expires_at=expires_at,
        email=email,
        identity_id=None,
        authentication_session_id=authentication_session.id,
    )
    await save_fixture(email_otp)
    return email_otp


@pytest.mark.anyio
class TestIssueLoginCode:
    async def test_issued_code_signs_in(
        self, session: AsyncSession, save_fixture: SaveFixture
    ) -> None:
        email_otp = await create_pending_sign_in(
            save_fixture, email="dev@example.com", code_hash="a" * 64, expires_in=600
        )

        issued = await issue_login_code(session)

        assert issued is not None
        issued_for, code = issued
        assert issued_for.id == email_otp.id
        _, consumed_email = await EmailOTPFactor(session).consume(
            code, email_otp.authentication_session_id
        )
        assert consumed_email == "dev@example.com"

    async def test_filters_by_email(
        self, session: AsyncSession, save_fixture: SaveFixture
    ) -> None:
        await create_pending_sign_in(
            save_fixture, email="first@example.com", code_hash="a" * 64, expires_in=600
        )
        await create_pending_sign_in(
            save_fixture, email="second@example.com", code_hash="b" * 64, expires_in=600
        )

        issued = await issue_login_code(session, "first@example.com")

        assert issued is not None
        assert issued[0].email == "first@example.com"

    async def test_ignores_expired_sign_in(
        self, session: AsyncSession, save_fixture: SaveFixture
    ) -> None:
        await create_pending_sign_in(
            save_fixture, email="dev@example.com", code_hash="a" * 64, expires_in=-60
        )

        assert await issue_login_code(session) is None
