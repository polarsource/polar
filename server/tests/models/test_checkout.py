from datetime import UTC, datetime

import pytest

from polar.models import Product
from polar.models.checkout import CheckoutStatus
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_checkout


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
@pytest.mark.parametrize(
    "initial_status,expected_status",
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
    price = product_one_time.prices[0]
    checkout = await create_checkout(save_fixture, price=price, status=initial_status)
    assert checkout.status == initial_status

    checkout.expires_at = datetime(2024, 1, 1, 0, 0, 0, 0, tzinfo=UTC)
    session.add(checkout)
    await session.flush()

    assert checkout.status == expected_status
