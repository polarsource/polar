import pytest
from httpx import AsyncClient

from polar.config import settings
from polar.models.account import Account
from polar.models.user import User


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
async def test_get_users_me_authed(
    user: User, auth_jwt: str, client: AsyncClient
) -> None:
    response = await client.get(
        "/api/v1/users/me",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200
    json = response.json()

    assert json["email"] == user.email
    assert "oauth_accounts" in json


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
async def test_get_users_me_no_auth(client: AsyncClient) -> None:
    response = await client.get(
        "/api/v1/users/me",
    )

    assert response.status_code == 401


@pytest.mark.asyncio
@pytest.mark.authenticated
@pytest.mark.http_auto_expunge
async def test_set_preferences_true(client: AsyncClient) -> None:
    response = await client.put(
        "/api/v1/users/me",
        json={
            "email_newsletters_and_changelogs": True,
            "email_promotions_and_events": True,
        },
    )

    assert response.status_code == 200
    json = response.json()

    assert json["email_newsletters_and_changelogs"] is True
    assert json["email_promotions_and_events"] is True
    assert "oauth_accounts" in json


@pytest.mark.asyncio
@pytest.mark.authenticated
@pytest.mark.http_auto_expunge
async def test_set_preferences_false(client: AsyncClient) -> None:
    response = await client.put(
        "/api/v1/users/me",
        json={
            "email_newsletters_and_changelogs": False,
            "email_promotions_and_events": False,
        },
    )

    assert response.status_code == 200
    json = response.json()

    assert json["email_newsletters_and_changelogs"] is False
    assert json["email_promotions_and_events"] is False
    assert "oauth_accounts" in json


@pytest.mark.asyncio
@pytest.mark.authenticated
@pytest.mark.http_auto_expunge
async def test_set_account(
    client: AsyncClient, open_collective_account: Account
) -> None:
    response = await client.patch(
        "/api/v1/users/me/account",
        json={
            "account_id": str(open_collective_account.id),
        },
    )

    assert response.status_code == 200
    json = response.json()

    assert json["account_id"] == str(open_collective_account.id)
