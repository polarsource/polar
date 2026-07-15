import pytest
import pytest_asyncio

from polar.models import Customer, Product
from polar.models.subscription import SubscriptionStatus
from polar.observability.invariants.rules.no_recent_subscriptions import (
    NoRecentSubscriptionsInvariant,
    NoRecentSubscriptionsInvariantError,
)
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_subscription


@pytest_asyncio.fixture
async def invariant(session: AsyncSession) -> NoRecentSubscriptionsInvariant:
    return NoRecentSubscriptionsInvariant(session)


@pytest.mark.asyncio
async def test_failure_no_subscriptions(
    invariant: NoRecentSubscriptionsInvariant,
) -> None:
    with pytest.raises(NoRecentSubscriptionsInvariantError) as exc_info:
        await invariant.check()
    assert exc_info.value.context["last_subscription_at"] is None


@pytest.mark.asyncio
async def test_success_recent_subscription(
    invariant: NoRecentSubscriptionsInvariant,
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

    await invariant.check()
