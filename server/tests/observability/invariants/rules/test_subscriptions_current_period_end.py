from datetime import timedelta

import pytest
import pytest_asyncio

from polar.kit.utils import utc_now
from polar.models import Customer, Product
from polar.models.subscription import SubscriptionStatus
from polar.observability.invariants.rules.subscriptions_current_period_end import (
    SubscriptionsCurrentPeriodEndInvariant,
    SubscriptionsCurrentPeriodEndInvariantError,
)
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_subscription


@pytest_asyncio.fixture
async def invariant(session: AsyncSession) -> SubscriptionsCurrentPeriodEndInvariant:
    return SubscriptionsCurrentPeriodEndInvariant(session)


@pytest.mark.asyncio
async def test_failure(
    invariant: SubscriptionsCurrentPeriodEndInvariant,
    save_fixture: SaveFixture,
    product: Product,
    customer: Customer,
) -> None:
    await create_subscription(
        save_fixture,
        status=SubscriptionStatus.active,
        product=product,
        customer=customer,
        current_period_end=utc_now() - timedelta(days=1),
    )

    with pytest.raises(SubscriptionsCurrentPeriodEndInvariantError) as exc_info:
        await invariant.check()
    assert exc_info.value.count == 1


@pytest.mark.asyncio
async def test_success(
    invariant: SubscriptionsCurrentPeriodEndInvariant,
    save_fixture: SaveFixture,
    product: Product,
    customer: Customer,
) -> None:
    await create_subscription(
        save_fixture,
        status=SubscriptionStatus.active,
        product=product,
        customer=customer,
    )
    # Past current_period_end, but below the threshold
    await create_subscription(
        save_fixture,
        status=SubscriptionStatus.active,
        product=product,
        customer=customer,
        current_period_end=utc_now() - timedelta(minutes=1),
    )

    await invariant.check()
