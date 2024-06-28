import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
class TestCreatePersonalAccessToken:
    @pytest.mark.auth
    async def test_expires_in_validation(self, client: AsyncClient) -> None:
        response = await client.post(
            "/v1/personal_access_tokens/",
            json={
                "comment": "hello world",
                "scopes": ["metrics:read"],
                "expires_in": 1000 * 86400,
            },
        )

        assert response.status_code == 422

    @pytest.mark.auth
    async def test_valid(self, client: AsyncClient) -> None:
        response = await client.post(
            "/v1/personal_access_tokens/",
            json={"comment": "hello world", "scopes": ["metrics:read"]},
        )

        assert response.status_code == 201

        json = response.json()
        assert "personal_access_token" in response.json()
        assert "token" in json
