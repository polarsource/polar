from datetime import timedelta
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture
from starlette.requests import Request

from polar.auth.middlewares import get_auth_subject
from polar.config import settings
from polar.kit.crypto import generate_token, get_token_hash
from polar.kit.utils import utc_now
from polar.models import PersonalAccessToken, User
from polar.personal_access_token.service import TOKEN_PREFIX as PAT_PREFIX
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture


@pytest.fixture(autouse=True)
def enqueue_job_mock(mocker: MockerFixture) -> MagicMock:
    return mocker.patch("polar.auth.middlewares.enqueue_job", autospec=True)


def _make_request_with_token(token: str) -> Request:
    scope = {
        "type": "http",
        "headers": [(b"authorization", f"Bearer {token}".encode())],
    }
    return Request(scope)


@pytest.mark.asyncio
class TestGetAuthSubjectChecksumValidation:
    async def test_valid_checksum_no_error_logged(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        user: User,
        mocker: MockerFixture,
    ) -> None:
        log_mock = mocker.patch("polar.auth.middlewares.log")

        token = generate_token(prefix=PAT_PREFIX)
        token_hash = get_token_hash(token, secret=settings.SECRET)
        pat = PersonalAccessToken(
            comment="Test",
            token=token_hash,
            user_id=user.id,
            expires_at=utc_now() + timedelta(days=1),
            scope="openid",
        )
        await save_fixture(pat)

        request = _make_request_with_token(token)
        auth_subject = await get_auth_subject(request, session)

        assert auth_subject.subject == user
        log_mock.error.assert_not_called()

    async def test_invalid_checksum_logs_error(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        user: User,
        mocker: MockerFixture,
    ) -> None:
        log_mock = mocker.patch("polar.auth.middlewares.log")

        legacy_token = PAT_PREFIX + "a" * 32
        token_hash = get_token_hash(legacy_token, secret=settings.SECRET)
        pat = PersonalAccessToken(
            comment="Legacy Token",
            token=token_hash,
            user_id=user.id,
            expires_at=utc_now() + timedelta(days=1),
            scope="openid",
        )
        await save_fixture(pat)

        request = _make_request_with_token(legacy_token)
        auth_subject = await get_auth_subject(request, session)

        assert auth_subject.subject == user
        log_mock.error.assert_called_once_with(
            "Valid token has invalid checksum",
            token_type="personal_access_token",
            token_prefix=PAT_PREFIX,
            token_length=len(legacy_token),
        )
