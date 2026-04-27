import uuid
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest
from dramatiq import Retry
from polar_sdk.models.resourcenotfound import ResourceNotFound, ResourceNotFoundData
from pytest_mock import MockerFixture

from polar.integrations.polar.client import PolarSelfClient
from polar.integrations.polar.tasks import (
    add_member,
    delete_customer,
    remove_member,
    track_event_ingestion,
    track_organization_review_usage,
)


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


@pytest.mark.asyncio
class TestFlushEventIngestion:
    SELF_ORG_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")

    def _patch_settings(self, mocker: MockerFixture, *, enabled: bool = True) -> None:
        settings = mocker.patch("polar.integrations.polar.tasks.settings")
        settings.POLAR_SELF_ENABLED = enabled
        settings.POLAR_ORGANIZATION_ID = str(self.SELF_ORG_ID)

    async def test_noop_when_not_configured(self, mocker: MockerFixture) -> None:
        self._patch_settings(mocker, enabled=False)
        client = AsyncMock(spec=PolarSelfClient)
        get_client = mocker.patch(
            "polar.integrations.polar.tasks.get_client", return_value=client
        )

        await track_event_ingestion()

        get_client.assert_not_called()

    async def test_noop_when_no_counts(self, mocker: MockerFixture) -> None:
        self._patch_settings(mocker)
        repository = MagicMock()
        repository.get_latest_polar_self_ingestion_timestamp = AsyncMock(
            return_value=None
        )
        repository.count_user_events_by_organization = AsyncMock(return_value={})
        mocker.patch(
            "polar.integrations.polar.tasks.EventRepository.from_session",
            return_value=repository,
        )
        client = AsyncMock(spec=PolarSelfClient)
        mocker.patch("polar.integrations.polar.tasks.get_client", return_value=client)

        await track_event_ingestion()

        client.track_event_ingestion.assert_not_called()

    async def test_calls_client_with_counts_and_cutoff(
        self, mocker: MockerFixture
    ) -> None:
        self._patch_settings(mocker)
        org_a = uuid.UUID("00000000-0000-0000-0000-00000000000a")
        last_flush = MagicMock()
        counts = {org_a: 7}
        repository = MagicMock()
        repository.get_latest_polar_self_ingestion_timestamp = AsyncMock(
            return_value=last_flush
        )
        repository.count_user_events_by_organization = AsyncMock(return_value=counts)
        mocker.patch(
            "polar.integrations.polar.tasks.EventRepository.from_session",
            return_value=repository,
        )
        client = AsyncMock(spec=PolarSelfClient)
        mocker.patch("polar.integrations.polar.tasks.get_client", return_value=client)

        await track_event_ingestion()

        repository.count_user_events_by_organization.assert_called_once()
        kwargs = repository.count_user_events_by_organization.call_args.kwargs
        assert kwargs["after"] is last_flush
        assert kwargs["exclude_organization_id"] == self.SELF_ORG_ID
        cutoff = kwargs["until"]

        client.track_event_ingestion.assert_called_once_with(
            counts=counts, cutoff=cutoff
        )


@pytest.mark.asyncio
class TestTrackOrganizationReviewUsage:
    async def test_calls_client_with_decimal_cost(
        self,
        mocker: MockerFixture,
    ) -> None:
        client = AsyncMock(spec=PolarSelfClient)
        mocker.patch("polar.integrations.polar.tasks.get_client", return_value=client)

        await track_organization_review_usage(
            external_customer_id="org-123",
            review_context="submission",
            vendor="openai",
            model="gpt-4o-mini",
            input_tokens=100,
            output_tokens=50,
            cost_usd="0.0123",
        )

        client.track_organization_review_usage.assert_called_once_with(
            external_customer_id="org-123",
            review_context="submission",
            vendor="openai",
            model="gpt-4o-mini",
            input_tokens=100,
            output_tokens=50,
            cost_usd=Decimal("0.0123"),
        )
