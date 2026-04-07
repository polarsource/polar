"""
External service mocks for E2E tests.

Each fixture silences one external integration so E2E tests never make
real network calls. All fixtures are ``autouse`` — they apply to every
test in the ``tests/e2e/`` directory automatically.
"""

from typing import Any
from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest
from pytest_mock import MockerFixture

ALLOWED_HOSTS = {"test", "localhost", "127.0.0.1"}


@pytest.fixture(autouse=True)
def _block_external_http(mocker: MockerFixture) -> None:
    """Reject any HTTP call to a non-localhost host.

    Catches unmocked external integrations with an actionable error message
    instead of letting them silently hit real services.
    """
    _original_send = httpx.AsyncClient.send

    async def _guarded_send(
        self: httpx.AsyncClient, request: httpx.Request, **kwargs: Any
    ) -> httpx.Response:
        if request.url.host not in ALLOWED_HOSTS:
            raise RuntimeError(
                f"Unmocked external HTTP call to {request.url.host}{request.url.path} "
                f"— add a mock to tests/e2e/external_mocks.py"
            )
        return await _original_send(self, request, **kwargs)

    mocker.patch.object(httpx.AsyncClient, "send", _guarded_send)


@pytest.fixture(autouse=True)
def mock_stripe_service(mocker: MockerFixture) -> MagicMock:
    """Mock the Stripe service globally for E2E tests.

    Provides safe defaults so free-product flows work without StripeSimulator.
    Tests that need payment should call stripe_sim.expect_payment() to override.
    """
    from types import SimpleNamespace

    from polar.integrations.stripe.service import StripeService

    mock = MagicMock(spec=StripeService)
    mocker.patch("polar.checkout.service.stripe_service", new=mock)
    mocker.patch("polar.integrations.stripe.payment.stripe_service", new=mock)
    mocker.patch("polar.payment_method.service.stripe_service", new=mock)
    mocker.patch("polar.order.service.stripe_service", new=mock)

    # Safe defaults so flows work without StripeSimulator
    mock.create_customer.return_value = SimpleNamespace(id="cus_e2e_default")
    mock.update_customer.return_value = SimpleNamespace(id="cus_e2e_default")
    # Renewal payment flow calls create_payment_intent for background charges
    mock.create_payment_intent.return_value = SimpleNamespace(
        id="pi_e2e_default",
        client_secret="pi_e2e_default_secret",
        status="succeeded",
        payment_method="pm_e2e_default",
    )

    from tests.fixtures.stripe import build_stripe_payment_method

    mock.get_payment_method.return_value = build_stripe_payment_method(
        type="card",
        details={
            "brand": "visa",
            "last4": "4242",
            "exp_month": 12,
            "exp_year": 2030,
            "country": "US",
            "fingerprint": "e2e_fingerprint",
        },
        customer="cus_e2e_default",
    )

    return mock


@pytest.fixture(autouse=True)
def mock_tax_calculation(mocker: MockerFixture) -> MagicMock:
    """Mock tax calculation to avoid external calls."""
    from polar.enums import TaxBehavior, TaxProcessor
    from polar.tax.calculation import TaxabilityReason, TaxCalculationService

    mock = MagicMock(spec=TaxCalculationService)
    mocker.patch("polar.checkout.service.tax_calculation_service", new=mock)
    mocker.patch("polar.order.service.tax_calculation_service", new=mock)
    mock.calculate.return_value = (
        {
            "processor_id": "TAX_E2E_TEST",
            "amount": 0,
            "taxability_reason": TaxabilityReason.standard_rated,
            "tax_behavior": TaxBehavior.exclusive,
            "tax_rate": {
                "rate_type": "percentage",
                "basis_points": 0,
                "amount": None,
                "amount_currency": None,
                "display_name": "Tax",
                "country": "US",
                "state": None,
            },
        },
        TaxProcessor.numeral,
    )
    mock.record.return_value = ("TAX_TXN_E2E", TaxProcessor.numeral)
    return mock


@pytest.fixture(autouse=True)
def mock_posthog(mocker: MockerFixture) -> MagicMock:
    """Silence PostHog analytics calls."""
    return mocker.patch("polar.checkout.service.posthog")


@pytest.fixture(autouse=True)
def mock_loops_client(mocker: MockerFixture) -> None:
    """Silence Loops.so HTTP calls from background tasks."""
    mock = MagicMock()
    mock.update_contact = AsyncMock()
    mock.send_event = AsyncMock()
    mocker.patch("polar.integrations.loops.tasks.loops_client", new=mock)


@pytest.fixture(autouse=True)
def mock_webhook_send(mocker: MockerFixture) -> MagicMock:
    """Mock webhook sending to avoid external HTTP calls."""
    return mocker.patch(
        "polar.webhook.service.WebhookService.send",
        new_callable=AsyncMock,
    )


@pytest.fixture(autouse=True)
def mock_publish_checkout_event(mocker: MockerFixture) -> AsyncMock:
    """Mock checkout event stream publishing."""
    return mocker.patch(
        "polar.checkout.eventstream.publish",
        new_callable=AsyncMock,
    )


@pytest.fixture(autouse=True)
def mock_invoice_service(mocker: MockerFixture) -> MagicMock:
    """Mock invoice service to avoid S3/MinIO calls.

    This prevents RequestTimeTooSkewed errors when using freezegun,
    since botocore signs requests with the (frozen) system clock while
    MinIO compares against its real clock.
    """
    mock = MagicMock()
    mock.create_order_invoice = AsyncMock(return_value="invoices/mock-invoice.pdf")
    mock.get_order_invoice_url = AsyncMock(
        return_value=("https://mock-s3/invoices/mock-invoice.pdf", None)
    )
    mocker.patch("polar.order.service.invoice_service", new=mock)
    return mock
