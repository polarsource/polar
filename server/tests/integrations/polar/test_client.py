from unittest.mock import AsyncMock

import pytest
from polar.base import PolarServerError
from polar.v2026_04.errors import (
    MissingInvoiceBillingDetails as SDKMissingInvoiceBillingDetails,
)
from polar.v2026_04.errors import (
    OrderNotEligibleForInvoice as SDKOrderNotEligibleForInvoice,
)
from polar.v2026_04.errors import (
    ResourceNotFound as SDKResourceNotFound,
)
from polar.v2026_04.outputs import (
    MissingInvoiceBillingDetails as MissingInvoiceBillingDetailsData,
)
from polar.v2026_04.outputs import (
    OrderNotEligibleForInvoice as OrderNotEligibleForInvoiceData,
)
from polar.v2026_04.outputs import (
    ResourceNotFound as ResourceNotFoundData,
)
from pytest_mock import MockerFixture

from polar.integrations.polar.client import (
    PolarSelfClient,
    PolarSelfClientError,
    PolarSelfClientOperationalError,
)
from polar.integrations.polar.exceptions import PolarSelfOrderNotEligible


def _client() -> PolarSelfClient:
    return PolarSelfClient(access_token="test", api_url="http://test")


def _not_eligible() -> SDKOrderNotEligibleForInvoice:
    return SDKOrderNotEligibleForInvoice(
        409,
        OrderNotEligibleForInvoiceData(
            error="OrderNotEligibleForInvoice",
            detail="Order ord_1 is not eligible for invoice generation (current status: void).",
        ),
    )


def _missing_billing() -> SDKMissingInvoiceBillingDetails:
    return SDKMissingInvoiceBillingDetails(
        422,
        MissingInvoiceBillingDetailsData(
            error="MissingInvoiceBillingDetails",
            detail="Billing name and address are required to generate an invoice for this order.",
        ),
    )


def _not_found() -> SDKResourceNotFound:
    return SDKResourceNotFound(
        404,
        ResourceNotFoundData(error="ResourceNotFound", detail="Not found"),
    )


@pytest.mark.asyncio
class TestTriggerOrderInvoiceGeneration:
    async def test_409_order_not_eligible_raises_polar_self_order_not_eligible(
        self, mocker: MockerFixture
    ) -> None:
        # The live API returns 409 OrderNotEligibleForInvoice for draft/void
        # orders. The wrapper must surface this as the terminal
        # PolarSelfOrderNotEligible (not the old "retry later" mapping).
        client = _client()
        mocker.patch.object(
            client._sdk.orders,
            "generate_invoice",
            new=AsyncMock(side_effect=_not_eligible()),
        )

        with pytest.raises(PolarSelfOrderNotEligible) as exc_info:
            await client.trigger_order_invoice_generation(order_id="ord_1")

        assert exc_info.value.order_id == "ord_1"
        assert isinstance(exc_info.value.__cause__, SDKOrderNotEligibleForInvoice)

    async def test_422_missing_billing_falls_through_to_client_error(
        self, mocker: MockerFixture
    ) -> None:
        # The wrapper no longer maps 422 (MissingInvoiceBillingDetails) to the
        # removed PolarSelfNotPaidOrder; it surfaces as a generic client error
        # so a caller can decide how to handle the permanent data problem.
        client = _client()
        mocker.patch.object(
            client._sdk.orders,
            "generate_invoice",
            new=AsyncMock(side_effect=_missing_billing()),
        )

        with pytest.raises(PolarSelfClientError) as exc_info:
            await client.trigger_order_invoice_generation(order_id="ord_1")

        assert not isinstance(exc_info.value, PolarSelfOrderNotEligible)
        assert "409" not in str(exc_info.value)
        assert "422" in str(exc_info.value)

    async def test_404_falls_through_to_client_error(
        self, mocker: MockerFixture
    ) -> None:
        client = _client()
        mocker.patch.object(
            client._sdk.orders,
            "generate_invoice",
            new=AsyncMock(side_effect=_not_found()),
        )

        with pytest.raises(PolarSelfClientError) as exc_info:
            await client.trigger_order_invoice_generation(order_id="ord_1")

        assert not isinstance(exc_info.value, PolarSelfOrderNotEligible)
        assert "404" in str(exc_info.value)

    async def test_5xx_raises_operational_error(self, mocker: MockerFixture) -> None:
        # Transient server errors must surface as the retryable
        # PolarSelfClientOperationalError, not the terminal ineligibility error.
        client = _client()
        mocker.patch.object(
            client._sdk.orders,
            "generate_invoice",
            new=AsyncMock(side_effect=PolarServerError(500, "boom")),
        )

        with pytest.raises(PolarSelfClientOperationalError):
            await client.trigger_order_invoice_generation(order_id="ord_1")

    async def test_success_returns_none(self, mocker: MockerFixture) -> None:
        client = _client()
        generate_invoice = mocker.patch.object(
            client._sdk.orders,
            "generate_invoice",
            new=AsyncMock(return_value=None),
        )

        await client.trigger_order_invoice_generation(order_id="ord_1")

        generate_invoice.assert_awaited_once_with("ord_1")
