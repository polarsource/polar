import pytest
from httpx import AsyncClient

from polar.kit.db.postgres import AsyncSession


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
@pytest.mark.auth
async def test_create(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/personal_access_tokens", json={"comment": "hello world"}
    )

    assert response.status_code == 200
    assert response.json()["expires_at"] is not None
    assert len(response.json()["token"]) > 20
    assert response.json()["comment"] == "hello world"


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
@pytest.mark.auth
async def test_list(client: AsyncClient, session: AsyncSession) -> None:
    t1 = await client.post("/api/v1/personal_access_tokens", json={"comment": "one"})

    t2 = await client.post("/api/v1/personal_access_tokens", json={"comment": "two"})

    response = await client.get("/api/v1/personal_access_tokens")

    assert response.status_code == 200
    assert len(response.json()["items"]) == 2
    ids = [t["id"] for t in response.json()["items"]]
    assert t1.json()["id"] in ids
    assert t2.json()["id"] in ids


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
@pytest.mark.auth
async def test_delete(client: AsyncClient) -> None:
    t1 = await client.post("/api/v1/personal_access_tokens", json={"comment": "one"})

    t2 = await client.post("/api/v1/personal_access_tokens", json={"comment": "two"})

    response = await client.delete(f"/api/v1/personal_access_tokens/{t1.json()['id']}")

    response = await client.get("/api/v1/personal_access_tokens")

    assert response.status_code == 200
    assert len(response.json()["items"]) == 1
    ids = [t["id"] for t in response.json()["items"]]
    assert t1.json()["id"] not in ids
    assert t2.json()["id"] in ids


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
@pytest.mark.auth
async def test_auth(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/personal_access_tokens", json={"comment": "hello world"}
    )

    assert response.status_code == 200


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
@pytest.mark.auth
async def test_create_scoped(client: AsyncClient, session: AsyncSession) -> None:
    response = await client.post(
        "/api/v1/personal_access_tokens",
        json={"comment": "rss", "scopes": ["articles:read"]},
    )

    assert response.status_code == 200
    assert response.json()["expires_at"] is not None
    assert len(response.json()["token"]) > 20
    assert response.json()["comment"] == "rss"
