from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest
from dramatiq import Retry
from polar_sdk.models.resourcenotfound import ResourceNotFound, ResourceNotFoundData
from pytest_mock import MockerFixture

from polar.integrations.polar.client import PolarSelfClient
from polar.integrations.polar.tasks import add_member, delete_customer, remove_member


@pytest.mark.asyncio
class TestAddMember:
    async def test_adds_member_to_existing_customer(
        self,
        mocker: MockerFixture,
    ) -> None:
        fake_customer = MagicMock(id="polar-customer-123")
        client = AsyncMock(spec=PolarSelfClient)
        client.get_customer_by_external_id.return_value = fake_customer
        mocker.patch("polar.integrations.polar.tasks.get_client", return_value=client)

        await add_member(
            external_customer_id="org-123",
            email="user@example.com",
            name="User Example",
            external_id="user-123",
        )

        client.get_customer_by_external_id.assert_called_once_with("org-123")
        client.add_member.assert_called_once_with(
            customer_id="polar-customer-123",
            email="user@example.com",
            name="User Example",
            external_id="user-123",
        )

    async def test_retries_when_customer_is_not_ready(
        self,
        mocker: MockerFixture,
    ) -> None:
        client = AsyncMock(spec=PolarSelfClient)
        client.get_customer_by_external_id.side_effect = ResourceNotFound(
            ResourceNotFoundData(detail="Not found"),
            httpx.Response(
                404,
                request=httpx.Request(
                    "GET", "http://127.0.0.1:8000/v1/customers/external/org-123"
                ),
            ),
        )
        mocker.patch("polar.integrations.polar.tasks.get_client", return_value=client)
        mocker.patch("polar.integrations.polar.tasks.can_retry", return_value=True)

        with pytest.raises(Retry):
            await add_member(
                external_customer_id="org-123",
                email="user@example.com",
                name="User Example",
                external_id="user-123",
            )

        client.add_member.assert_not_called()

    async def test_raises_not_found_when_retries_exhausted(
        self,
        mocker: MockerFixture,
    ) -> None:
        not_found = ResourceNotFound(
            ResourceNotFoundData(detail="Not found"),
            httpx.Response(
                404,
                request=httpx.Request(
                    "GET", "http://127.0.0.1:8000/v1/customers/external/org-123"
                ),
            ),
        )
        client = AsyncMock(spec=PolarSelfClient)
        client.get_customer_by_external_id.side_effect = not_found
        mocker.patch("polar.integrations.polar.tasks.get_client", return_value=client)
        mocker.patch("polar.integrations.polar.tasks.can_retry", return_value=False)

        with pytest.raises(ResourceNotFound):
            await add_member(
                external_customer_id="org-123",
                email="user@example.com",
                name="User Example",
                external_id="user-123",
            )


@pytest.mark.asyncio
class TestRemoveMember:
    async def test_removes_existing_member(
        self,
        mocker: MockerFixture,
    ) -> None:
        client = AsyncMock(spec=PolarSelfClient)
        client.get_member_by_external_id.return_value = MagicMock(id="member-123")
        mocker.patch("polar.integrations.polar.tasks.get_client", return_value=client)

        await remove_member(
            external_customer_id="org-123",
            external_id="user-123",
        )

        client.get_member_by_external_id.assert_called_once_with(
            external_customer_id="org-123",
            external_id="user-123",
        )
        client.remove_member.assert_called_once_with(
            external_customer_id="org-123",
            external_id="user-123",
        )

    async def test_retries_when_member_is_not_ready(
        self,
        mocker: MockerFixture,
    ) -> None:
        client = AsyncMock(spec=PolarSelfClient)
        client.get_member_by_external_id.side_effect = ResourceNotFound(
            ResourceNotFoundData(detail="Not found"),
            httpx.Response(
                404,
                request=httpx.Request(
                    "GET",
                    "http://127.0.0.1:8000/v1/members/external/user-123?external_customer_id=org-123",
                ),
            ),
        )
        mocker.patch("polar.integrations.polar.tasks.get_client", return_value=client)
        mocker.patch("polar.integrations.polar.tasks.can_retry", return_value=True)

        with pytest.raises(Retry):
            await remove_member(
                external_customer_id="org-123",
                external_id="user-123",
            )

        client.remove_member.assert_not_called()

    async def test_noops_when_member_never_appears(
        self,
        mocker: MockerFixture,
    ) -> None:
        client = AsyncMock(spec=PolarSelfClient)
        client.get_member_by_external_id.side_effect = ResourceNotFound(
            ResourceNotFoundData(detail="Not found"),
            httpx.Response(
                404,
                request=httpx.Request(
                    "GET",
                    "http://127.0.0.1:8000/v1/members/external/user-123?external_customer_id=org-123",
                ),
            ),
        )
        mocker.patch("polar.integrations.polar.tasks.get_client", return_value=client)
        mocker.patch("polar.integrations.polar.tasks.can_retry", return_value=False)

        await remove_member(
            external_customer_id="org-123",
            external_id="user-123",
        )

        client.remove_member.assert_not_called()


@pytest.mark.asyncio
class TestDeleteCustomer:
    async def test_deletes_customer_by_external_id(
        self,
        mocker: MockerFixture,
    ) -> None:
        client = AsyncMock(spec=PolarSelfClient)
        mocker.patch("polar.integrations.polar.tasks.get_client", return_value=client)

        await delete_customer(external_id="org-123")

        client.delete_customer.assert_called_once_with(external_id="org-123")
