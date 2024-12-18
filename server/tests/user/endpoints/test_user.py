import pytest
from httpx import AsyncClient

from polar.models.account import Account
from polar.models.user import User
from tests.fixtures.auth import AuthSubjectFixture


@pytest.mark.asyncio
@pytest.mark.auth
async def test_get_users_me_authed(user: User, client: AsyncClient) -> None:
    response = await client.get("/v1/users/me")

    assert response.status_code == 200
    json = response.json()

    assert json["email"] == user.email
    assert "oauth_accounts" in json


@pytest.mark.asyncio
async def test_get_users_me_no_auth(client: AsyncClient) -> None:
    response = await client.get(
        "/v1/users/me",
    )

    assert response.status_code == 401


@pytest.mark.asyncio
@pytest.mark.auth(AuthSubjectFixture(subject="user_blocked"))
async def test_get_users_me_blocked(user_blocked: User, client: AsyncClient) -> None:
    response = await client.get("/v1/users/me")
    assert response.status_code == 403


@pytest.mark.asyncio
@pytest.mark.auth
async def test_set_account(
    client: AsyncClient, open_collective_account: Account
) -> None:
    response = await client.patch(
        "/v1/users/me/account",
        json={
            "account_id": str(open_collective_account.id),
        },
    )

    assert response.status_code == 200
    json = response.json()

    assert json["account_id"] == str(open_collective_account.id)


@pytest.mark.asyncio
@pytest.mark.auth(AuthSubjectFixture(subject="user_blocked"))
async def test_blocked_user_set_account(
    client: AsyncClient, open_collective_account: Account
) -> None:
    response = await client.patch(
        "/v1/users/me/account",
        json={
            "account_id": str(open_collective_account.id),
        },
    )

    assert response.status_code == 403
