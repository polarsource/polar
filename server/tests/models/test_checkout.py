from datetime import UTC, datetime

import pytest

from polar.kit.address import Address, CountryAlpha2
from polar.models import Product
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
