from collections.abc import AsyncIterator
from typing import Any
from unittest.mock import MagicMock

import pytest

from polar.integrations.polar.client import PolarSelfClient


@pytest.mark.asyncio
class TestListBillingContacts:
    async def test_lists_owner_and_billing_manager_via_customer_members(self) -> None:
        client = PolarSelfClient(access_token="token", api_url="https://api.example")
        owner = object()
        billing_manager = object()
        calls: list[dict[str, Any]] = []

        async def iter_list(
            customer_id: str,
            *,
            role: str | None = None,
            limit: int = 10,
            **kwargs: object,
        ) -> AsyncIterator[object]:
            calls.append({"customer_id": customer_id, "role": role, "limit": limit})
            if role == "owner":
                yield owner
            elif role == "billing_manager":
                yield billing_manager

        client._sdk = MagicMock()
        client._sdk.customers.members.iter_list = iter_list

        contacts = await client.list_billing_contacts(customer_id="cust_1")

        assert contacts == [owner, billing_manager]
        assert calls == [
            {"customer_id": "cust_1", "role": "owner", "limit": 100},
            {"customer_id": "cust_1", "role": "billing_manager", "limit": 100},
        ]
