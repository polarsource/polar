import uuid
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest
from dramatiq import Retry
from polar_sdk.models.resourcenotfound import ResourceNotFound, ResourceNotFoundData
from pytest_mock import MockerFixture

from polar.config import settings
from polar.integrations.polar.client import PolarSelfClient
from polar.integrations.polar.tasks import (
    add_member,
    create_customer,
    delete_customer,
    remove_member,
    track_event_ingestion,
    track_organization_review_usage,
    update_customer_slug,
    update_member,
)


@pytest.fixture
def plain_service_mock(mocker: MockerFixture) -> MagicMock:
    mock = MagicMock()
    mock.upsert_tenant = AsyncMock()
    mock.update_tenant_tier = AsyncMock()
    mock.upsert_customer = AsyncMock()
    mock.add_customer_to_tenant = AsyncMock()
    mock.remove_customer_from_tenant = AsyncMock()
    mocker.patch("polar.integrations.polar.tasks.plain_service", mock)
    return mock


@pytest.mark.asyncio
class TestCreateCustomer:
    async def test_creates_customer_and_plain_tenant(
        self,
        mocker: MockerFixture,
        plain_service_mock: MagicMock,
    ) -> None:
        client = AsyncMock(spec=PolarSelfClient)
        mocker.patch("polar.integrations.polar.tasks.get_client", return_value=client)

        await create_customer(
            external_id="org-123",
            name="Acme Inc",
            slug="acme",
            owner_external_id="user-123",
            owner_email="owner@example.com",
            owner_name="Owner",
        )

        client.create_customer.assert_called_once_with(
            external_id="org-123",
            name="Acme Inc",
            slug="acme",
            owner_external_id="user-123",
            owner_email="owner@example.com",
            owner_name="Owner",
        )
        plain_service_mock.upsert_tenant.assert_awaited_once_with(
            external_id="org-123",
            name="Acme Inc",
            default_tier_external_id=settings.PLAIN_DEFAULT_TIER_EXTERNAL_ID,
        )

    async def test_forwards_default_plain_tier_when_configured(
        self,
        mocker: MockerFixture,
        plain_service_mock: MagicMock,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        monkeypatch.setattr(settings, "PLAIN_DEFAULT_TIER_EXTERNAL_ID", "free")
        client = AsyncMock(spec=PolarSelfClient)
        mocker.patch("polar.integrations.polar.tasks.get_client", return_value=client)

        await create_customer(
            external_id="org-123",
            name="Acme Inc",
            slug="acme",
            owner_external_id="user-123",
            owner_email="owner@example.com",
            owner_name="Owner",
        )

        plain_service_mock.upsert_tenant.assert_awaited_once_with(
            external_id="org-123",
            name="Acme Inc",
            default_tier_external_id="free",
        )


@pytest.mark.asyncio
class TestAddMember:
    async def test_adds_member_to_existing_customer(
        self,
        mocker: MockerFixture,
        plain_service_mock: MagicMock,
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
            role="member",
        )
        plain_service_mock.add_customer_to_tenant.assert_awaited_once_with(
            customer_external_id="user-123",
            tenant_external_id="org-123",
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
        plain_service_mock: MagicMock,
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
        plain_service_mock.remove_customer_from_tenant.assert_awaited_once_with(
            customer_external_id="user-123",
            tenant_external_id="org-123",
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
class TestUpdateMember:
    async def test_updates_member_name(
        self,
        mocker: MockerFixture,
    ) -> None:
        client = AsyncMock(spec=PolarSelfClient)
        mocker.patch("polar.integrations.polar.tasks.get_client", return_value=client)

        await update_member(
            external_customer_id="org-123",
            external_id="user-123",
            name="Updated Name",
        )

        client.update_member.assert_called_once_with(
            external_customer_id="org-123",
            external_id="user-123",
            name="Updated Name",
        )


@pytest.mark.asyncio
class TestUpdateCustomerSlug:
    async def test_merges_slug_into_existing_metadata(
        self,
        mocker: MockerFixture,
    ) -> None:
        fake_customer = MagicMock()
        fake_customer.metadata = {"slug": "old-slug", "other": "keep"}
        client = AsyncMock(spec=PolarSelfClient)
        client.get_customer_by_external_id_or_none.return_value = fake_customer
        mocker.patch("polar.integrations.polar.tasks.get_client", return_value=client)

        await update_customer_slug(external_id="org-123", slug="new-slug")

        client.get_customer_by_external_id_or_none.assert_called_once_with("org-123")
        client.update_customer_metadata.assert_called_once_with(
            external_id="org-123",
            metadata={"slug": "new-slug", "other": "keep"},
        )

    async def test_sets_slug_when_metadata_empty(
        self,
        mocker: MockerFixture,
    ) -> None:
        fake_customer = MagicMock()
        fake_customer.metadata = None
        client = AsyncMock(spec=PolarSelfClient)
        client.get_customer_by_external_id_or_none.return_value = fake_customer
        mocker.patch("polar.integrations.polar.tasks.get_client", return_value=client)

        await update_customer_slug(external_id="org-123", slug="new-slug")

        client.update_customer_metadata.assert_called_once_with(
            external_id="org-123",
            metadata={"slug": "new-slug"},
        )

    async def test_noops_when_customer_not_found(
        self,
        mocker: MockerFixture,
    ) -> None:
        client = AsyncMock(spec=PolarSelfClient)
        client.get_customer_by_external_id_or_none.return_value = None
        mocker.patch("polar.integrations.polar.tasks.get_client", return_value=client)

        await update_customer_slug(external_id="org-123", slug="new-slug")

        client.update_customer_metadata.assert_not_called()


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
        mocker.patch(
            "polar.integrations.polar.tasks.EventRepository.from_session",
            return_value=repository,
        )
        mocker.patch(
            "polar.integrations.polar.tasks.count_user_events_by_organization",
            return_value={},
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
        mocker.patch(
            "polar.integrations.polar.tasks.EventRepository.from_session",
            return_value=repository,
        )
        count_mock = mocker.patch(
            "polar.integrations.polar.tasks.count_user_events_by_organization",
            return_value=counts,
        )
        client = AsyncMock(spec=PolarSelfClient)
        mocker.patch("polar.integrations.polar.tasks.get_client", return_value=client)

        await track_event_ingestion()

        count_mock.assert_called_once()
        kwargs = count_mock.call_args.kwargs
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
