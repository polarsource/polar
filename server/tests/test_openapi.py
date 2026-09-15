import pytest
from httpx import AsyncClient

from polar.kit.versioning import APIVersion
from polar.version import V2026_04, V2026_10, VERSIONS


@pytest.mark.asyncio
@pytest.mark.parametrize("version", VERSIONS)
async def test_openapi(version: APIVersion, client: AsyncClient) -> None:
    response = await client.get(f"{version}/openapi.json")
    assert response.status_code == 200

    schema = response.json()
    assert "Scope" in schema["components"]["schemas"]

    assert len(schema["webhooks"]) > 0
    assert schema["info"]["version"] == str(version)


@pytest.mark.asyncio
async def test_subscription_migrated_webhook_is_next_only(
    client: AsyncClient,
) -> None:
    current = (await client.get(f"{V2026_04}/openapi.json")).json()
    nxt = (await client.get(f"{V2026_10}/openapi.json")).json()

    assert "subscription.migrated" not in current["webhooks"]
    assert "subscription.migrated" in nxt["webhooks"]
    assert (
        "subscription.migrated"
        in current["components"]["schemas"]["WebhookEventType"]["enum"]
    )
