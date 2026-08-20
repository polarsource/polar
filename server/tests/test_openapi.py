import pytest
from httpx import AsyncClient

from polar.kit.versioning import APIVersion
from polar.version import VERSIONS


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
@pytest.mark.parametrize("version", VERSIONS)
async def test_confirm_payment_method_customer_not_ready_response_code(
    version: APIVersion, client: AsyncClient
) -> None:
    response = await client.get(f"{version}/openapi.json")
    assert response.status_code == 200

    schema = response.json()
    confirm_payment_method_responses = schema["paths"][
        "/v1/customer-portal/customers/me/payment-methods/confirm"
    ]["post"]["responses"]
    assert "403" in confirm_payment_method_responses
    assert "400" not in confirm_payment_method_responses
    assert (
        confirm_payment_method_responses["403"]["content"]["application/json"]["schema"][
            "$ref"
        ]
        == "#/components/schemas/CustomerNotReady"
    )
