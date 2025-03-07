import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
@pytest.mark.auth
async def test_get(client: AsyncClient) -> None:
    response = await client.get("/v1/notifications")

    assert response.status_code == 200
