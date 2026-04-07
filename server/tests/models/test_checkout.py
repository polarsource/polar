from collections.abc import Callable
from datetime import UTC, datetime

import pytest

from polar.config import settings
from polar.kit.address import Address, CountryAlpha2
from polar.kit.trial import TrialInterval
from polar.models import Checkout, Product
from polar.models.checkout import BillingAddressFieldMode, CheckoutStatus
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_checkout


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("initial_status", "expected_status"),
    [
        (
            CheckoutStatus.open,
            CheckoutStatus.expired,
        ),
        (
            CheckoutStatus.confirmed,
            CheckoutStatus.confirmed,
        ),
        (
            CheckoutStatus.failed,
            CheckoutStatus.failed,
        ),
    ],
)
async def test_checkout_expired_status_update(
    initial_status: CheckoutStatus,
    expected_status: CheckoutStatus,
    save_fixture: SaveFixture,
    session: AsyncSession,
    product_one_time: Product,
) -> None:
    checkout = await create_checkout(
        save_fixture, products=[product_one_time], status=initial_status
    )
    assert checkout.status == initial_status

    checkout.expires_at = datetime(2024, 1, 1, 0, 0, 0, 0, tzinfo=UTC)
    session.add(checkout)
    await session.flush()

    assert checkout.status == expected_status


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("country", "require_billing_address", "expected_state_mode"),
    [
        ("FR", False, BillingAddressFieldMode.disabled),
        ("FR", True, BillingAddressFieldMode.optional),
        ("US", True, BillingAddressFieldMode.required),
        ("CA", True, BillingAddressFieldMode.required),
    ],
)
async def test_billing_address_fields(
    country: CountryAlpha2,
    require_billing_address: bool,
    expected_state_mode: BillingAddressFieldMode,
    save_fixture: SaveFixture,
    product_one_time: Product,
) -> None:
    checkout = await create_checkout(
        save_fixture,
        products=[product_one_time],
        require_billing_address=require_billing_address,
        customer_billing_address=Address(country=country),
    )

    assert (
        checkout.billing_address_fields["country"] == BillingAddressFieldMode.required
    )
    assert checkout.billing_address_fields["state"] == expected_state_mode


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("success_url_input", "expected_factory"),
    [
        pytest.param(
            "https://example.com/success?checkout_id={CHECKOUT_ID}",
            lambda checkout: f"https://example.com/success?checkout_id={checkout.id}",
            id="checkout_id_replacement",
        ),
        pytest.param(
            "https://example.com/success",
            lambda checkout: "https://example.com/success",
            id="no_placeholder",
        ),
        pytest.param(
            'https://example.com/callback?data={"key":"value"}',
            lambda checkout: 'https://example.com/callback?data={"key":"value"}',
            id="literal_brace",
        ),
        pytest.param(
            None,
            lambda checkout: settings.generate_frontend_url(
                f"/checkout/{checkout.client_secret}/confirmation"
            ),
            id="none_url",
        ),
    ],
)
async def test_success_url(
    save_fixture: SaveFixture,
    product_one_time: Product,
    success_url_input: str | None,
    expected_factory: Callable[[Checkout], str],
) -> None:
    checkout = await create_checkout(save_fixture, products=[product_one_time])
    checkout._success_url = success_url_input

    expected = expected_factory(checkout)
    assert checkout.success_url == expected


@pytest.mark.asyncio
async def test_active_trial_interval_none_for_non_recurring_product(
    save_fixture: SaveFixture,
    product_one_time: Product,
) -> None:
    checkout = await create_checkout(
        save_fixture,
        products=[product_one_time],
        trial_interval=TrialInterval.day,
        trial_interval_count=14,
    )

    assert checkout.active_trial_interval is None


@pytest.mark.asyncio
async def test_active_trial_interval_count_none_for_non_recurring_product(
    save_fixture: SaveFixture,
    product_one_time: Product,
) -> None:
    checkout = await create_checkout(
        save_fixture,
        products=[product_one_time],
        trial_interval=TrialInterval.day,
        trial_interval_count=14,
    )

    assert checkout.active_trial_interval_count is None
