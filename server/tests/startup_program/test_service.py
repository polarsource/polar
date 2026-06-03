import uuid
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
from pytest_mock import MockerFixture

from polar.config import settings
from polar.models import Organization
from polar.startup_program.service import (
    DISCOUNT_BASIS_POINTS,
    DISCOUNT_DURATION_IN_MONTHS,
    DISCOUNT_ID_KEY,
    DISCOUNT_MAX_REDEMPTIONS,
    StartupProgramError,
    StartupProgramStatus,
)
from polar.startup_program.service import startup_program as startup_program_service

POLAR_ORG_ID = str(uuid.UUID("00000000-0000-0000-0000-0000000000a1"))
SCALE_PRODUCT_ID = "prod_scale"
SDK_CUSTOMER_ID = "cust_sdk_1"
SDK_DISCOUNT_ID = "disc_sdk_1"


def _make_sdk_customer(
    *,
    external_id: str,
    metadata: dict[str, Any] | None = None,
    customer_id: str = SDK_CUSTOMER_ID,
) -> MagicMock:
    customer = MagicMock()
    customer.id = customer_id
    customer.external_id = external_id
    customer.metadata = metadata or {}
    return customer


def _make_sdk_discount(
    *,
    discount_id: str = SDK_DISCOUNT_ID,
    redemptions_count: int = 0,
    max_redemptions: int | None = DISCOUNT_MAX_REDEMPTIONS,
) -> MagicMock:
    discount = MagicMock()
    discount.id = discount_id
    discount.redemptions_count = redemptions_count
    discount.max_redemptions = max_redemptions
    return discount


def _make_billing_contact(email: str) -> MagicMock:
    contact = MagicMock()
    contact.email = email
    return contact


@pytest.fixture
def configure_startup_program(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "POLAR_ORGANIZATION_ID", POLAR_ORG_ID)
    monkeypatch.setattr(settings, "POLAR_SCALE_PRODUCT_ID", SCALE_PRODUCT_ID)
    monkeypatch.setattr(settings, "POLAR_ACCESS_TOKEN", "polar_test_token")


@pytest.fixture
def client_mock(mocker: MockerFixture) -> MagicMock:
    """Default SDK client mock — every method is set; tests override per case."""
    client = MagicMock()
    client.get_customer_by_external_id_or_none = AsyncMock(return_value=None)
    client.get_discount = AsyncMock(return_value=None)
    client.create_percentage_discount = AsyncMock(return_value=_make_sdk_discount())
    client.delete_discount = AsyncMock(return_value=None)
    client.update_customer_metadata = AsyncMock(return_value=None)
    client.list_billing_contacts = AsyncMock(return_value=[])
    mocker.patch("polar.startup_program.service.get_client", return_value=client)
    return client


@pytest.mark.asyncio
class TestMarkInvited:
    async def test_raises_when_not_configured(
        self,
        monkeypatch: pytest.MonkeyPatch,
        organization: Organization,
    ) -> None:
        monkeypatch.setattr(settings, "POLAR_ORGANIZATION_ID", "")
        monkeypatch.setattr(settings, "POLAR_SCALE_PRODUCT_ID", "")

        with pytest.raises(StartupProgramError):
            await startup_program_service.mark_invited(organization)

    @pytest.mark.usefixtures("configure_startup_program")
    async def test_raises_when_no_polar_customer(
        self,
        client_mock: MagicMock,
        organization: Organization,
    ) -> None:
        client_mock.get_customer_by_external_id_or_none.return_value = None

        with pytest.raises(StartupProgramError, match="No Polar customer"):
            await startup_program_service.mark_invited(organization)

    @pytest.mark.usefixtures("configure_startup_program")
    async def test_creates_discount_and_updates_metadata(
        self,
        client_mock: MagicMock,
        organization: Organization,
    ) -> None:
        client_mock.get_customer_by_external_id_or_none.return_value = (
            _make_sdk_customer(
                external_id=str(organization.id),
                metadata={"other": "preserved"},
            )
        )
        new_discount = _make_sdk_discount(discount_id="disc_new")
        client_mock.create_percentage_discount.return_value = new_discount

        result = await startup_program_service.mark_invited(organization)

        assert result is new_discount

        create_kwargs = client_mock.create_percentage_discount.call_args.kwargs
        assert create_kwargs["basis_points"] == DISCOUNT_BASIS_POINTS
        assert create_kwargs["duration_in_months"] == DISCOUNT_DURATION_IN_MONTHS
        assert create_kwargs["max_redemptions"] == DISCOUNT_MAX_REDEMPTIONS
        # No product constraint: the discount must be attachable to a
        # subscription before its product is switched to Scale, so proration
        # at the switch reflects the discount.
        assert create_kwargs["products"] is None
        # POLAR_ACCESS_TOKEN is organization-scoped, so the API rejects any
        # explicit organization_id on the request.
        assert "organization_id" not in create_kwargs

        update_kwargs = client_mock.update_customer_metadata.call_args.kwargs
        assert update_kwargs["external_id"] == str(organization.id)
        # Existing metadata is preserved, new pointer is added.
        assert update_kwargs["metadata"] == {
            "other": "preserved",
            DISCOUNT_ID_KEY: "disc_new",
        }

    @pytest.mark.usefixtures("configure_startup_program")
    async def test_returns_existing_when_pointer_resolves(
        self,
        client_mock: MagicMock,
        organization: Organization,
    ) -> None:
        existing = _make_sdk_discount(discount_id="disc_existing")
        client_mock.get_customer_by_external_id_or_none.return_value = (
            _make_sdk_customer(
                external_id=str(organization.id),
                metadata={DISCOUNT_ID_KEY: "disc_existing"},
            )
        )
        client_mock.get_discount.return_value = existing

        result = await startup_program_service.mark_invited(organization)

        assert result is existing
        client_mock.create_percentage_discount.assert_not_called()
        client_mock.update_customer_metadata.assert_not_called()

    @pytest.mark.usefixtures("configure_startup_program")
    async def test_creates_fresh_when_pointer_is_dead(
        self,
        client_mock: MagicMock,
        organization: Organization,
    ) -> None:
        # Customer points to a discount that the API no longer returns
        # (404 → ``get_discount`` returns None). A fresh discount is created.
        client_mock.get_customer_by_external_id_or_none.return_value = (
            _make_sdk_customer(
                external_id=str(organization.id),
                metadata={DISCOUNT_ID_KEY: "disc_deleted"},
            )
        )
        client_mock.get_discount.return_value = None
        client_mock.create_percentage_discount.return_value = _make_sdk_discount(
            discount_id="disc_fresh"
        )

        result = await startup_program_service.mark_invited(organization)

        assert result.id == "disc_fresh"
        client_mock.create_percentage_discount.assert_called_once()
        update_kwargs = client_mock.update_customer_metadata.call_args.kwargs
        assert update_kwargs["metadata"][DISCOUNT_ID_KEY] == "disc_fresh"

    @pytest.mark.usefixtures("configure_startup_program")
    async def test_wraps_sdk_failure_as_startup_program_error(
        self,
        client_mock: MagicMock,
        organization: Organization,
    ) -> None:
        # Any SDK / network failure during the invite path must surface as a
        # StartupProgramError so the backoffice action toasts the reason
        # instead of 500-ing.
        client_mock.get_customer_by_external_id_or_none.return_value = (
            _make_sdk_customer(external_id=str(organization.id))
        )
        client_mock.create_percentage_discount.side_effect = RuntimeError(
            "discounts API down"
        )

        with pytest.raises(StartupProgramError, match="discounts API down"):
            await startup_program_service.mark_invited(organization)

    @pytest.mark.usefixtures("configure_startup_program")
    async def test_sends_welcome_email_to_billing_contacts(
        self,
        client_mock: MagicMock,
        mocker: MockerFixture,
        organization: Organization,
    ) -> None:
        enqueue_mock = mocker.patch(
            "polar.startup_program.service.enqueue_email_template"
        )
        client_mock.get_customer_by_external_id_or_none.return_value = (
            _make_sdk_customer(external_id=str(organization.id))
        )
        client_mock.list_billing_contacts.return_value = [
            _make_billing_contact("founder@acme.ai"),
        ]

        await startup_program_service.mark_invited(organization)

        assert enqueue_mock.call_count == 1
        call_kwargs = enqueue_mock.call_args.kwargs
        assert call_kwargs["to_email_addr"] == "founder@acme.ai"
        assert "Startup Program" in call_kwargs["subject"]


@pytest.mark.asyncio
class TestUninvite:
    @pytest.mark.usefixtures("configure_startup_program")
    async def test_deletes_discount_and_clears_pointer(
        self,
        client_mock: MagicMock,
        organization: Organization,
    ) -> None:
        client_mock.get_customer_by_external_id_or_none.return_value = (
            _make_sdk_customer(
                external_id=str(organization.id),
                metadata={
                    "other": "preserved",
                    DISCOUNT_ID_KEY: "disc_unused",
                },
            )
        )
        client_mock.get_discount.return_value = _make_sdk_discount(
            discount_id="disc_unused", redemptions_count=0
        )

        await startup_program_service.uninvite(organization)

        client_mock.delete_discount.assert_awaited_once_with(discount_id="disc_unused")
        # Pointer is cleared; other metadata keys preserved.
        update_kwargs = client_mock.update_customer_metadata.call_args.kwargs
        assert update_kwargs["external_id"] == str(organization.id)
        assert update_kwargs["metadata"] == {"other": "preserved"}

    @pytest.mark.usefixtures("configure_startup_program")
    async def test_refuses_when_discount_already_redeemed(
        self,
        client_mock: MagicMock,
        organization: Organization,
    ) -> None:
        client_mock.get_customer_by_external_id_or_none.return_value = (
            _make_sdk_customer(
                external_id=str(organization.id),
                metadata={DISCOUNT_ID_KEY: "disc_used"},
            )
        )
        client_mock.get_discount.return_value = _make_sdk_discount(
            discount_id="disc_used", redemptions_count=1
        )

        with pytest.raises(StartupProgramError, match="redeemed"):
            await startup_program_service.uninvite(organization)

        client_mock.delete_discount.assert_not_called()
        client_mock.update_customer_metadata.assert_not_called()

    @pytest.mark.usefixtures("configure_startup_program")
    async def test_clears_pointer_when_discount_already_gone(
        self,
        client_mock: MagicMock,
        organization: Organization,
    ) -> None:
        """If the API returns 404 for the discount, the discount is already
        deleted; we still clear the stale customer pointer."""
        client_mock.get_customer_by_external_id_or_none.return_value = (
            _make_sdk_customer(
                external_id=str(organization.id),
                metadata={DISCOUNT_ID_KEY: "disc_gone"},
            )
        )
        client_mock.get_discount.return_value = None

        await startup_program_service.uninvite(organization)

        client_mock.delete_discount.assert_not_called()
        client_mock.update_customer_metadata.assert_awaited_once()

    @pytest.mark.usefixtures("configure_startup_program")
    async def test_raises_when_no_pointer(
        self,
        client_mock: MagicMock,
        organization: Organization,
    ) -> None:
        client_mock.get_customer_by_external_id_or_none.return_value = (
            _make_sdk_customer(external_id=str(organization.id), metadata={})
        )

        with pytest.raises(StartupProgramError, match="no Startup Program"):
            await startup_program_service.uninvite(organization)

    @pytest.mark.usefixtures("configure_startup_program")
    async def test_raises_when_no_polar_customer(
        self,
        client_mock: MagicMock,
        organization: Organization,
    ) -> None:
        client_mock.get_customer_by_external_id_or_none.return_value = None

        with pytest.raises(StartupProgramError, match="No Polar customer"):
            await startup_program_service.uninvite(organization)


@pytest.mark.asyncio
class TestGetStatus:
    @pytest.mark.usefixtures("configure_startup_program")
    async def test_none_when_no_customer(self, client_mock: MagicMock) -> None:
        client_mock.get_customer_by_external_id_or_none.return_value = None

        assert await startup_program_service.get_status(uuid.uuid4()) is None

    @pytest.mark.usefixtures("configure_startup_program")
    async def test_none_when_no_pointer(self, client_mock: MagicMock) -> None:
        client_mock.get_customer_by_external_id_or_none.return_value = (
            _make_sdk_customer(external_id=str(uuid.uuid4()), metadata={})
        )

        assert await startup_program_service.get_status(uuid.uuid4()) is None

    @pytest.mark.usefixtures("configure_startup_program")
    async def test_none_when_discount_returns_404(self, client_mock: MagicMock) -> None:
        # API returned 404 for the pointed-to discount (deleted or missing).
        client_mock.get_customer_by_external_id_or_none.return_value = (
            _make_sdk_customer(
                external_id=str(uuid.uuid4()),
                metadata={DISCOUNT_ID_KEY: "disc_gone"},
            )
        )
        client_mock.get_discount.return_value = None

        assert await startup_program_service.get_status(uuid.uuid4()) is None

    @pytest.mark.usefixtures("configure_startup_program")
    async def test_invited_when_redemptions_zero(self, client_mock: MagicMock) -> None:
        client_mock.get_customer_by_external_id_or_none.return_value = (
            _make_sdk_customer(
                external_id=str(uuid.uuid4()),
                metadata={DISCOUNT_ID_KEY: SDK_DISCOUNT_ID},
            )
        )
        client_mock.get_discount.return_value = _make_sdk_discount(redemptions_count=0)

        assert (
            await startup_program_service.get_status(uuid.uuid4())
            == StartupProgramStatus.invited
        )

    @pytest.mark.usefixtures("configure_startup_program")
    async def test_none_when_sdk_raises(self, client_mock: MagicMock) -> None:
        # The backoffice / billing-page reads must not 500 if the SDK errors;
        # they degrade to "not invited" and log.
        client_mock.get_customer_by_external_id_or_none.side_effect = RuntimeError(
            "SDK boom"
        )

        assert await startup_program_service.get_status(uuid.uuid4()) is None

    @pytest.mark.usefixtures("configure_startup_program")
    async def test_consumed_when_redemptions_at_least_one(
        self, client_mock: MagicMock
    ) -> None:
        client_mock.get_customer_by_external_id_or_none.return_value = (
            _make_sdk_customer(
                external_id=str(uuid.uuid4()),
                metadata={DISCOUNT_ID_KEY: SDK_DISCOUNT_ID},
            )
        )
        client_mock.get_discount.return_value = _make_sdk_discount(redemptions_count=1)

        assert (
            await startup_program_service.get_status(uuid.uuid4())
            == StartupProgramStatus.consumed
        )


@pytest.mark.asyncio
class TestResolveCheckoutDiscountId:
    @pytest.mark.usefixtures("configure_startup_program")
    async def test_returns_id_when_invited(self, client_mock: MagicMock) -> None:
        client_mock.get_customer_by_external_id_or_none.return_value = (
            _make_sdk_customer(
                external_id=str(uuid.uuid4()),
                metadata={DISCOUNT_ID_KEY: SDK_DISCOUNT_ID},
            )
        )
        client_mock.get_discount.return_value = _make_sdk_discount(
            discount_id="disc_match", redemptions_count=0
        )

        resolved = await startup_program_service.resolve_checkout_discount_id(
            organization_id=uuid.uuid4(), product_id=SCALE_PRODUCT_ID
        )

        assert resolved == "disc_match"

    @pytest.mark.usefixtures("configure_startup_program")
    async def test_none_when_not_scale_product(self, client_mock: MagicMock) -> None:
        resolved = await startup_program_service.resolve_checkout_discount_id(
            organization_id=uuid.uuid4(), product_id="prod_other"
        )

        assert resolved is None
        # Short-circuits before any SDK call.
        client_mock.get_customer_by_external_id_or_none.assert_not_called()

    @pytest.mark.usefixtures("configure_startup_program")
    async def test_none_when_fully_redeemed(self, client_mock: MagicMock) -> None:
        client_mock.get_customer_by_external_id_or_none.return_value = (
            _make_sdk_customer(
                external_id=str(uuid.uuid4()),
                metadata={DISCOUNT_ID_KEY: SDK_DISCOUNT_ID},
            )
        )
        client_mock.get_discount.return_value = _make_sdk_discount(
            redemptions_count=1, max_redemptions=1
        )

        resolved = await startup_program_service.resolve_checkout_discount_id(
            organization_id=uuid.uuid4(), product_id=SCALE_PRODUCT_ID
        )

        assert resolved is None

    async def test_none_when_disabled(
        self,
        monkeypatch: pytest.MonkeyPatch,
        client_mock: MagicMock,
    ) -> None:
        monkeypatch.setattr(settings, "POLAR_ORGANIZATION_ID", "")
        monkeypatch.setattr(settings, "POLAR_SCALE_PRODUCT_ID", "")

        resolved = await startup_program_service.resolve_checkout_discount_id(
            organization_id=uuid.uuid4(), product_id=SCALE_PRODUCT_ID
        )

        assert resolved is None
        client_mock.get_customer_by_external_id_or_none.assert_not_called()
