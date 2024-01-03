from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient
from pytest_mock import MockerFixture

from polar.config import settings
from polar.kit.utils import generate_uuid
from polar.magic_link.service import InvalidMagicLink
from polar.magic_link.service import magic_link as magic_link_service
from polar.models import MagicLink, User


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
async def test_request(client: AsyncClient, mocker: MockerFixture) -> None:
    magic_link_service_request_mock = mocker.patch.object(
        magic_link_service,
        "request",
        new=AsyncMock(
            return_value=(
                MagicLink(
                    token_hash="x",
                    user_email="x",
                    user_id=generate_uuid(),
                ),
                "TOKEN",
            )
        ),
    )
    magic_link_service_send_mock = mocker.patch.object(
        magic_link_service, "send", new=AsyncMock()
    )

    response = await client.post(
        "/api/v1/magic_link/request", json={"email": "user@example.com"}
    )

    assert response.status_code == 202

    assert magic_link_service_request_mock.called
    assert magic_link_service_send_mock.called


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
async def test_authenticate_invalid_token(
    client: AsyncClient, mocker: MockerFixture
) -> None:
    magic_link_service_mock = mocker.patch.object(
        magic_link_service, "authenticate", side_effect=InvalidMagicLink()
    )

    response = await client.get(
        "/api/v1/magic_link/authenticate", params={"token": "TOKEN"}
    )

    assert response.status_code == 303
    assert response.headers["Location"].startswith(
        f"{settings.FRONTEND_BASE_URL}/error"
    )

    assert magic_link_service_mock.called
    assert magic_link_service_mock.call_args[0][1] == "TOKEN"


@pytest.mark.asyncio
@pytest.mark.authenticated
@pytest.mark.http_auto_expunge
async def test_authenticate_already_authenticated(
    client: AsyncClient, user: User, mocker: MockerFixture
) -> None:
    magic_link_service_mock = mocker.patch.object(
        magic_link_service, "authenticate", new=AsyncMock(return_value=user)
    )

    response = await client.get(
        "/api/v1/magic_link/authenticate", params={"token": "TOKEN"}
    )

    assert response.status_code == 303
    assert response.headers["Location"].startswith(f"{settings.FRONTEND_BASE_URL}/feed")

    magic_link_service_mock.assert_not_called()


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
async def test_authenticate_valid_token(
    client: AsyncClient, user: User, mocker: MockerFixture
) -> None:
    magic_link_service_mock = mocker.patch.object(
        magic_link_service, "authenticate", new=AsyncMock(return_value=user)
    )

    response = await client.get(
        "/api/v1/magic_link/authenticate", params={"token": "TOKEN"}
    )

    assert response.status_code == 303
    assert response.headers["Location"].startswith(f"{settings.FRONTEND_BASE_URL}/feed")

    assert settings.AUTH_COOKIE_KEY in response.cookies

    assert magic_link_service_mock.called
    assert magic_link_service_mock.call_args[0][1] == "TOKEN"
