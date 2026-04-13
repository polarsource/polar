import pytest
from httpx import AsyncClient

from polar.models.account import Account


@pytest.mark.asyncio
@pytest.mark.auth
async def test_update(account: Account, client: AsyncClient) -> None:
    response = await client.patch(
        f"/v1/accounts/{account.id}",
        json={
            "billing_name": "John Doe",
            "billing_address": {
                "line1": "123 Main St",
                "postal_code": "10001",
                "city": "New York",
                "state": "NY",
                "country": "US",
            },
            "billing_notes": "This is a test billing note.",
        },
    )

    assert response.status_code == 200

    json = response.json()
    assert json["billing_name"] == "John Doe"
    assert json["billing_address"]["city"] == "New York"
    assert json["billing_notes"] == "This is a test billing note."
