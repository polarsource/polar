import uuid
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock

import pytest
from dramatiq import Retry
from polar.base import PolarServerError
from polar.v2026_04.errors import ResourceNotFound
from polar.v2026_04.outputs import ResourceNotFound as ResourceNotFoundData
from pytest_mock import MockerFixture

from polar.config import settings
from polar.integrations.plain.service import TenantOperationError
from polar.integrations.polar.client import PolarSelfClient
from polar.integrations.polar.exceptions import (
    PolarSelfInvoiceNotReady,
    PolarSelfOrderNotEligible,
)
from polar.integrations.polar.tasks import (
    add_member,
    create_customer,
    delete_customer,
    remove_member,
    track_event_ingestion,
    track_organization_review_usage,
    update_customer_slug,
    update_member,
    webhook_order_created,
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
            404,
            ResourceNotFoundData(error="ResourceNotFound", detail="Not found"),
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
            404,
            ResourceNotFoundData(error="ResourceNotFound", detail="Not found"),
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
    async def test_removes_member_and_unlinks_plain_tenant(
        self,
        mocker: MockerFixture,
        plain_service_mock: MagicMock,
    ) -> None:
        client = AsyncMock(spec=PolarSelfClient)
        mocker.patch("polar.integrations.polar.tasks.get_client", return_value=client)

        await remove_member(
            external_customer_id="org-123",
            external_id="user-123",
        )

        client.get_member_by_external_id.assert_not_called()
        client.remove_member.assert_called_once_with(
            external_customer_id="org-123",
            external_id="user-123",
        )
        plain_service_mock.remove_customer_from_tenant.assert_awaited_once_with(
            customer_external_id="user-123",
            tenant_external_id="org-123",
        )

    async def test_plain_unlink_failure_propagates_for_retry(
        self,
        mocker: MockerFixture,
        plain_service_mock: MagicMock,
    ) -> None:
        client = AsyncMock(spec=PolarSelfClient)
        mocker.patch("polar.integrations.polar.tasks.get_client", return_value=client)
        plain_service_mock.remove_customer_from_tenant.side_effect = (
            TenantOperationError("org-123", "remove_customer", "Plain API failure")
        )

        with pytest.raises(TenantOperationError):
            await remove_member(
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

    async def test_plain_unlink_retried_after_polar_removal(
        self,
        mocker: MockerFixture,
        plain_service_mock: MagicMock,
    ) -> None:
        client = AsyncMock(spec=PolarSelfClient)
        mocker.patch("polar.integrations.polar.tasks.get_client", return_value=client)
        plain_service_mock.remove_customer_from_tenant.side_effect = [
            TenantOperationError("org-123", "remove_customer", "Plain API failure"),
            None,
        ]

        with pytest.raises(TenantOperationError):
            await remove_member(
                external_customer_id="org-123",
                external_id="user-123",
            )

        await remove_member(
            external_customer_id="org-123",
            external_id="user-123",
        )

        assert client.remove_member.await_count == 2
        assert plain_service_mock.remove_customer_from_tenant.await_count == 2
        client.remove_member.assert_called_with(
            external_customer_id="org-123",
            external_id="user-123",
        )
        plain_service_mock.remove_customer_from_tenant.assert_called_with(
            customer_external_id="user-123",
            tenant_external_id="org-123",
        )


@pytest.mark.asyncio
class TestUpdateMember:
    async def test_updates_member_name(
        self,
        mocker: MockerFixture,
    ) -> None:
        client = AsyncMock(spec=PolarSelfClient)
        client.get_member_by_external_id.return_value = MagicMock(id="member-123")
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
            role=None,
        )

    async def test_forwards_role(
        self,
        mocker: MockerFixture,
    ) -> None:
        client = AsyncMock(spec=PolarSelfClient)
        client.get_member_by_external_id.return_value = MagicMock(id="member-123")
        mocker.patch("polar.integrations.polar.tasks.get_client", return_value=client)

        await update_member(
            external_customer_id="org-123",
            external_id="user-123",
            name="Updated Name",
            role="billing_manager",
        )

        client.update_member.assert_called_once_with(
            external_customer_id="org-123",
            external_id="user-123",
            name="Updated Name",
            role="billing_manager",
        )

    async def test_retries_when_member_is_not_ready(
        self,
        mocker: MockerFixture,
    ) -> None:
        client = AsyncMock(spec=PolarSelfClient)
        client.get_member_by_external_id.side_effect = ResourceNotFound(
            404,
            ResourceNotFoundData(error="ResourceNotFound", detail="Not found"),
        )
        mocker.patch("polar.integrations.polar.tasks.get_client", return_value=client)
        mocker.patch("polar.integrations.polar.tasks.can_retry", return_value=True)

        with pytest.raises(Retry):
            await update_member(
                external_customer_id="org-123",
                external_id="user-123",
                name="Updated Name",
                role="billing_manager",
            )

        client.update_member.assert_not_called()

    async def test_noops_when_customer_exists_but_member_is_gone(
        self,
        mocker: MockerFixture,
    ) -> None:
        client = AsyncMock(spec=PolarSelfClient)
        client.get_member_by_external_id.side_effect = ResourceNotFound(
            404,
            ResourceNotFoundData(error="ResourceNotFound", detail="Not found"),
        )
        client.get_customer_by_external_id_or_none.return_value = MagicMock(
            id="polar-customer-123"
        )
        mocker.patch("polar.integrations.polar.tasks.get_client", return_value=client)
        mocker.patch("polar.integrations.polar.tasks.can_retry", return_value=False)

        await update_member(
            external_customer_id="org-123",
            external_id="user-123",
            name="Updated Name",
            role="billing_manager",
        )

        client.get_customer_by_external_id_or_none.assert_called_once_with("org-123")
        client.update_member.assert_not_called()

    async def test_raises_when_customer_not_yet_created_and_retries_exhausted(
        self,
        mocker: MockerFixture,
    ) -> None:
        not_found = ResourceNotFound(
            404,
            ResourceNotFoundData(error="ResourceNotFound", detail="Not found"),
        )
        client = AsyncMock(spec=PolarSelfClient)
        client.get_member_by_external_id.side_effect = not_found
        client.get_customer_by_external_id_or_none.return_value = None
        mocker.patch("polar.integrations.polar.tasks.get_client", return_value=client)
        mocker.patch("polar.integrations.polar.tasks.can_retry", return_value=False)

        with pytest.raises(ResourceNotFound):
            await update_member(
                external_customer_id="org-123",
                external_id="user-123",
                name="Updated Name",
                role="billing_manager",
            )

        client.get_customer_by_external_id_or_none.assert_called_once_with("org-123")
        client.update_member.assert_not_called()

    async def test_propagates_error_when_customer_lookup_fails_on_exhausted_404(
        self,
        mocker: MockerFixture,
    ) -> None:
        not_found = ResourceNotFound(
            404,
            ResourceNotFoundData(error="ResourceNotFound", detail="Not found"),
        )
        client = AsyncMock(spec=PolarSelfClient)
        client.get_member_by_external_id.side_effect = not_found
        client.get_customer_by_external_id_or_none.side_effect = PolarServerError(
            503, "Service Unavailable"
        )
        mocker.patch("polar.integrations.polar.tasks.get_client", return_value=client)
        mocker.patch("polar.integrations.polar.tasks.can_retry", return_value=False)

        with pytest.raises(PolarServerError):
            await update_member(
                external_customer_id="org-123",
                external_id="user-123",
                name="Updated Name",
                role="billing_manager",
            )

        client.get_customer_by_external_id_or_none.assert_called_once_with("org-123")
        client.update_member.assert_not_called()


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
            usage_id="usage-123",
        )

        client.track_organization_review_usage.assert_called_once_with(
            external_customer_id="org-123",
            review_context="submission",
            vendor="openai",
            model="gpt-4o-mini",
            input_tokens=100,
            output_tokens=50,
            cost_usd=Decimal("0.0123"),
            usage_id="usage-123",
        )


@pytest.fixture
def webhook_order_created_context(mocker: MockerFixture) -> None:
    session_ctx = AsyncMock()
    session_ctx.__aenter__.return_value = MagicMock()
    mocker.patch(
        "polar.integrations.polar.tasks.AsyncSessionMaker",
        return_value=session_ctx,
    )

    event_mock = MagicMock()
    event_mock.data = {"id": "ord_1"}
    handle_cm = AsyncMock()
    handle_cm.__aenter__.return_value = event_mock
    mocker.patch(
        "polar.integrations.polar.tasks.external_event_service.handle",
        return_value=handle_cm,
    )

    mocker.patch(
        "polar.integrations.polar.tasks.deserialize",
        return_value=MagicMock(name="payload"),
    )


@pytest.mark.asyncio
class TestWebhookOrderCreated:
    async def test_retries_on_invoice_not_ready(
        self,
        webhook_order_created_context: None,
        mocker: MockerFixture,
    ) -> None:
        mocker.patch("polar.integrations.polar.tasks.can_retry", return_value=True)
        service_mock = mocker.patch("polar.integrations.polar.tasks.polar_self")
        service_mock.handle_order_created_event = AsyncMock(
            side_effect=PolarSelfInvoiceNotReady("ord_1")
        )

        with pytest.raises(Retry):
            await webhook_order_created(uuid.uuid4())

    async def test_order_not_eligible_is_terminal_no_retry(
        self,
        webhook_order_created_context: None,
        mocker: MockerFixture,
    ) -> None:
        # A draft/void order is permanently ineligible: the actor must drop the
        # message instead of raising Retry, so the Retries middleware cannot
        # burn up to 20 attempts on an order that will never become eligible.
        can_retry_mock = mocker.patch(
            "polar.integrations.polar.tasks.can_retry", return_value=True
        )
        service_mock = mocker.patch("polar.integrations.polar.tasks.polar_self")
        service_mock.handle_order_created_event = AsyncMock(
            side_effect=PolarSelfOrderNotEligible("ord_1")
        )

        await webhook_order_created(uuid.uuid4())

        can_retry_mock.assert_not_called()

    async def test_invoice_not_ready_raises_when_retries_exhausted(
        self,
        webhook_order_created_context: None,
        mocker: MockerFixture,
    ) -> None:
        mocker.patch("polar.integrations.polar.tasks.can_retry", return_value=False)
        service_mock = mocker.patch("polar.integrations.polar.tasks.polar_self")
        service_mock.handle_order_created_event = AsyncMock(
            side_effect=PolarSelfInvoiceNotReady("ord_1")
        )

        with pytest.raises(PolarSelfInvoiceNotReady):
            await webhook_order_created(uuid.uuid4())
