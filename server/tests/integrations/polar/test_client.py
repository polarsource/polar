import uuid
from collections.abc import AsyncIterator
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
from polar.base import PolarNetworkError, PolarServerError, deserialize
from polar.v2026_04.errors import HTTPValidationError as SDKHTTPValidationError
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
from polar.integrations.polar.exceptions import (
    PolarSelfCustomerNotFound,
    PolarSelfOrderNotEligible,
)


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


def _validation_error(field: str, msg: str) -> SDKHTTPValidationError:
    return SDKHTTPValidationError(
        422,
        deserialize(
            {
                "detail": [
                    {
                        "type": "value_error",
                        "loc": ["body", field],
                        "msg": msg,
                        "input": "x",
                    }
                ]
            },
            SDKHTTPValidationError.error_type,
        ),
    )


@pytest.mark.anyio
class TestCustomerSessionErrors:
    async def test_missing_customer_raises_customer_not_found(
        self, mocker: MockerFixture
    ) -> None:
        organization_id = uuid.uuid4()
        client = _client()
        mocker.patch.object(
            client._sdk.customer_sessions,
            "create",
            new=AsyncMock(
                side_effect=_validation_error(
                    "external_customer_id", "Customer does not exist."
                )
            ),
        )

        with pytest.raises(PolarSelfCustomerNotFound) as exc_info:
            await client.portal_get_customer(external_customer_id=str(organization_id))

        assert exc_info.value.organization_id == organization_id

    async def test_missing_member_stays_client_error(
        self, mocker: MockerFixture
    ) -> None:
        client = _client()
        mocker.patch.object(
            client._sdk.customer_sessions,
            "create",
            new=AsyncMock(
                side_effect=_validation_error(
                    "external_member_id", "Member does not exist for this customer."
                )
            ),
        )

        with pytest.raises(PolarSelfClientError):
            await client.portal_create_customer_session(
                external_customer_id=str(uuid.uuid4()), external_member_id="user"
            )


@pytest.mark.anyio
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


def _members(*emails: str) -> list[MagicMock]:
    members = []
    for email in emails:
        member = MagicMock()
        member.email = email
        members.append(member)
    return members


def _async_iter(items: list[Any]) -> AsyncIterator[Any]:
    async def _gen() -> AsyncIterator[Any]:
        for item in items:
            yield item

    return _gen()


@pytest.mark.anyio
class TestListBillingContacts:
    async def test_resource_not_found_for_role_is_skipped(
        self, mocker: MockerFixture
    ) -> None:
        # A 404 for one role means "no members with that role" — not a failure.
        # The wrapper must skip it and still return the other role's contacts.
        client = _client()
        owner, *_ = _members("owner@example.com")

        def iter_list(customer_id: str, *, role: str, limit: int) -> Any:
            if role == "owner":
                return _async_iter([owner])
            raise _not_found()

        mocker.patch.object(
            client._sdk.customers.members,
            "iter_list",
            side_effect=iter_list,
        )

        contacts = await client.list_billing_contacts(customer_id="cus_1")

        assert contacts == [owner]

    async def test_resource_not_found_for_all_roles_returns_empty(
        self, mocker: MockerFixture
    ) -> None:
        client = _client()
        mocker.patch.object(
            client._sdk.customers.members,
            "iter_list",
            side_effect=_not_found(),
        )

        contacts = await client.list_billing_contacts(customer_id="cus_1")

        assert contacts == []

    async def test_other_error_still_raises(self, mocker: MockerFixture) -> None:
        # A non-"not found" error (here a 5xx) must not be swallowed — it should
        # surface so the task retries.
        client = _client()
        mocker.patch.object(
            client._sdk.customers.members,
            "iter_list",
            side_effect=PolarServerError(500, "boom"),
        )

        with pytest.raises(PolarSelfClientOperationalError):
            await client.list_billing_contacts(customer_id="cus_1")


def _failing_iter() -> AsyncIterator[Any]:
    async def _gen() -> AsyncIterator[Any]:
        raise PolarNetworkError("ReadTimeout")
        yield

    return _gen()


@pytest.mark.anyio
class TestNetworkErrorRetry:
    async def test_retries_once_then_succeeds(self, mocker: MockerFixture) -> None:
        mocker.patch("polar.integrations.polar.client.NETWORK_RETRY_DELAY_SECONDS", 0)
        client = _client()
        grant = object()
        iter_list = mocker.patch.object(
            client._sdk.benefit_grants,
            "iter_list",
            side_effect=[_failing_iter(), _async_iter([grant])],
        )

        grants = await client.list_customer_benefit_grants(customer_id="cus_1")

        assert grants == [grant]
        assert iter_list.call_count == 2

    async def test_repeated_network_errors_raise(self, mocker: MockerFixture) -> None:
        mocker.patch("polar.integrations.polar.client.NETWORK_RETRY_DELAY_SECONDS", 0)
        client = _client()
        get = mocker.patch.object(
            client._sdk.orders,
            "get",
            new=AsyncMock(side_effect=PolarNetworkError("ReadTimeout")),
        )

        with pytest.raises(
            PolarSelfClientOperationalError,
            match="get_order failed with network error: PolarNetworkError",
        ):
            await client.get_order(order_id="ord_1")

        assert get.await_count == 2
