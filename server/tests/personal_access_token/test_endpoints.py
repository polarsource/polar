import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
class TestCreatePersonalAccessToken:
    @pytest.mark.parametrize("expires_in", [None, 3600])
    @pytest.mark.auth
    async def test_valid(self, client: AsyncClient, expires_in: int | None) -> None:
        response = await client.post(
            "/v1/personal_access_tokens/",
            json={
                "comment": "hello world",
                "scopes": ["metrics:read"],
                "expires_in": expires_in,
            },
        )

        assert response.status_code == 201

        json = response.json()
        assert "personal_access_token" in response.json()
        assert "token" in json
