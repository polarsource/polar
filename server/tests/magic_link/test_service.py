from collections.abc import Callable, Coroutine
from uuid import UUID
from datetime import datetime, UTC, timedelta

import pytest
import pytest_asyncio
from pydantic import EmailStr
from pytest_mock import MockerFixture

from polar.models import MagicLink, User
from polar.kit.crypto import get_token_hash, generate_token
from polar.magic_link.service import magic_link as magic_link_service, InvalidMagicLink
from polar.magic_link.schemas import MagicLinkRequest
from polar.kit.db.postgres import AsyncSession
from polar.config import settings

GenerateMagicLinkToken = Callable[
    [str, UUID | None, datetime | None], Coroutine[None, None, tuple[MagicLink, str]]
]


@pytest_asyncio.fixture
async def generate_magic_link_token(
    session: AsyncSession,
) -> GenerateMagicLinkToken:
    async def _generate_magic_link_token(
        user_email: str, user_id: UUID | None, expires_at: datetime | None
    ) -> tuple[MagicLink, str]:
        token, token_hash = generate_token(secret=settings.SECRET)
        magic_link = MagicLink(
            token_hash=token_hash,
            user_email=user_email,
            user_id=user_id,
            expires_at=expires_at,
        )
        session.add(magic_link)
        await session.commit()

        return magic_link, token

    return _generate_magic_link_token


@pytest.mark.asyncio
async def test_request(session: AsyncSession, mocker: MockerFixture) -> None:
    enqueue_job_mock = mocker.patch("polar.worker._enqueue_job")

    magic_link_request = MagicLinkRequest(email=EmailStr("user@example.com"))

    magic_link = await magic_link_service.request(session, magic_link_request)

    assert magic_link.user_email == "user@example.com"

    assert enqueue_job_mock.called
    assert enqueue_job_mock.call_args[0][0] == "magic_link.request"
    assert enqueue_job_mock.call_args[1]["magic_link_id"] == magic_link.id
    assert (
        get_token_hash(enqueue_job_mock.call_args[1]["token"], secret=settings.SECRET)
        == magic_link.token_hash
    )


@pytest.mark.asyncio
async def test_authenticate_invalid_token(session: AsyncSession) -> None:
    with pytest.raises(InvalidMagicLink):
        await magic_link_service.authenticate(session, "INVALID_TOKEN")


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "expires_at",
    [
        datetime(1900, 1, 1, tzinfo=UTC),
        datetime.now(UTC) - timedelta(seconds=1),
        datetime.now(UTC),
    ],
)
async def test_authenticate_expired_token(
    session: AsyncSession,
    expires_at: datetime,
    generate_magic_link_token: GenerateMagicLinkToken,
) -> None:
    _, token = await generate_magic_link_token("user@example.com", None, expires_at)
    with pytest.raises(InvalidMagicLink):
        await magic_link_service.authenticate(session, token)


@pytest.mark.asyncio
async def test_authenticate_existing_user(
    session: AsyncSession, generate_magic_link_token: GenerateMagicLinkToken
) -> None:
    user = User(username="user@example.com", email="user@example.com")
    session.add(user)
    await session.commit()

    magic_link, token = await generate_magic_link_token(user.email, user.id, None)

    authenticated_user = await magic_link_service.authenticate(session, token)
    assert authenticated_user.id == user.id

    deleted_magic_link = await magic_link_service.get(session, magic_link.id)
    assert deleted_magic_link is None


@pytest.mark.asyncio
async def test_authenticate_existing_user_unlinked_from_magic_token(
    session: AsyncSession, generate_magic_link_token: GenerateMagicLinkToken
) -> None:
    user = User(username="user@example.com", email="user@example.com")
    session.add(user)
    await session.commit()

    magic_link, token = await generate_magic_link_token("user@example.com", None, None)

    authenticated_user = await magic_link_service.authenticate(session, token)
    assert authenticated_user.id == user.id

    deleted_magic_link = await magic_link_service.get(session, magic_link.id)
    assert deleted_magic_link is None


@pytest.mark.asyncio
async def test_authenticate_new_user(
    session: AsyncSession, generate_magic_link_token: GenerateMagicLinkToken
) -> None:
    magic_link, token = await generate_magic_link_token("user@example.com", None, None)

    authenticated_user = await magic_link_service.authenticate(session, token)
    assert authenticated_user.email == magic_link.user_email

    deleted_magic_link = await magic_link_service.get(session, magic_link.id)
    assert deleted_magic_link is None
