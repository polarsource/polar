from unittest.mock import AsyncMock, MagicMock

import pytest
from polar.base import PolarNetworkError
from polar.v2026_04.errors import ResourceNotFound
from polar.v2026_04.outputs import ResourceNotFound as ResourceNotFoundData

from polar.integrations.polar.client import (
    PolarSelfClient,
    PolarSelfClientOperationalError,
)


@pytest.fixture
def client() -> PolarSelfClient:
    client = PolarSelfClient(access_token="token", api_url="https://api.polar.sh")
    client._sdk = MagicMock()
    client._sdk.customers.members.get_external = AsyncMock()
    return client


@pytest.mark.asyncio
class TestGetMemberByExternalId:
    async def test_returns_member(self, client: PolarSelfClient) -> None:
        member = MagicMock(id="member-123")
        client._sdk.customers.members.get_external.return_value = member

        result = await client.get_member_by_external_id(
            external_customer_id="org-123",
            external_id="user-123",
        )

        assert result is member
        client._sdk.customers.members.get_external.assert_awaited_once_with(
            "org-123",
            "user-123",
        )

    async def test_converts_network_error_to_operational_error(
        self, client: PolarSelfClient
    ) -> None:
        client._sdk.customers.members.get_external.side_effect = PolarNetworkError(
            "connection reset"
        )

        with pytest.raises(PolarSelfClientOperationalError):
            await client.get_member_by_external_id(
                external_customer_id="org-123",
                external_id="user-123",
            )

    async def test_propagates_client_error(self, client: PolarSelfClient) -> None:
        client._sdk.customers.members.get_external.side_effect = ResourceNotFound(
            404,
            ResourceNotFoundData(error="ResourceNotFound", detail="Not found"),
        )

        with pytest.raises(ResourceNotFound):
            await client.get_member_by_external_id(
                external_customer_id="org-123",
                external_id="user-123",
            )
