import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
async def test_openapi(client: AsyncClient) -> None:
    response = await client.get("/openapi.json")
    assert response.status_code == 200

    schema = response.json()
    assert "Scope" in schema["components"]["schemas"]
