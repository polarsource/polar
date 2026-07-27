from datetime import timedelta

import pytest
import pytest_asyncio

from polar.kit.utils import utc_now
from polar.models import Customer, Product
from polar.models.subscription import SubscriptionStatus
from polar.observability.invariants.rules.subscriptions_future_period_start import (
    SubscriptionsFuturePeriodStartInvariant,
    SubscriptionsFuturePeriodStartInvariantError,
)
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_subscription


@pytest_asyncio.fixture
async def invariant(session: AsyncSession) -> SubscriptionsFuturePeriodStartInvariant:
    return SubscriptionsFuturePeriodStartInvariant(session)


@pytest.mark.asyncio
async def test_failure(
    invariant: SubscriptionsFuturePeriodStartInvariant,
    save_fixture: SaveFixture,
    product: Product,
    customer: Customer,
) -> None:
    subscription = await create_subscription(
        save_fixture,
        status=SubscriptionStatus.active,
        product=product,
        customer=customer,
        current_period_start=utc_now() + timedelta(days=1),
    )

    with pytest.raises(SubscriptionsFuturePeriodStartInvariantError) as exc_info:
        await invariant.check()
    assert exc_info.value.context == {
        "count": 1,
        "subscriptions": {"ids": [subscription.id], "has_more": False},
    }


@pytest.mark.asyncio
async def test_failure_over_limit(
    invariant: SubscriptionsFuturePeriodStartInvariant,
    save_fixture: SaveFixture,
    product: Product,
    customer: Customer,
) -> None:
    for _ in range(15):
        await create_subscription(
            save_fixture,
            status=SubscriptionStatus.active,
            product=product,
            customer=customer,
            current_period_start=utc_now() + timedelta(days=1),
        )

    with pytest.raises(SubscriptionsFuturePeriodStartInvariantError) as exc_info:
        await invariant.check()
    assert exc_info.value.context["count"] == 15
    assert len(exc_info.value.context["subscriptions"]["ids"]) == 10
    assert exc_info.value.context["subscriptions"]["has_more"] is True


@pytest.mark.asyncio
async def test_success(
    invariant: SubscriptionsFuturePeriodStartInvariant,
    save_fixture: SaveFixture,
    product: Product,
    customer: Customer,
) -> None:
    await create_subscription(
        save_fixture,
        status=SubscriptionStatus.active,
        product=product,
        customer=customer,
        current_period_start=utc_now() - timedelta(minutes=1),
    )
    await create_subscription(
        save_fixture,
        status=SubscriptionStatus.active,
        product=product,
        customer=customer,
        current_period_start=utc_now() - timedelta(minutes=2),
    )

    await invariant.check()
