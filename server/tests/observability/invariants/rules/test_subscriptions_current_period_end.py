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
from polar.subscription.repository import SubscriptionRepository
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
    stale = utc_now() - timedelta(days=1)
    subscription = await create_subscription(
        save_fixture,
        status=SubscriptionStatus.active,
        product=product,
        customer=customer,
        current_period_end=stale,
        created_at=stale,
        modified_at=stale,
    )

    with pytest.raises(SubscriptionsCurrentPeriodEndInvariantError) as exc_info:
        await invariant.check()
    assert exc_info.value.context == {
        "count": 1,
        "subscriptions": {"ids": [subscription.id], "has_more": False},
    }


@pytest.mark.asyncio
async def test_failure_never_updated_subscription(
    invariant: SubscriptionsCurrentPeriodEndInvariant,
    save_fixture: SaveFixture,
    product: Product,
    customer: Customer,
) -> None:
    """A subscription that never cycled has a NULL modified_at, which must not hide it."""
    stale = utc_now() - timedelta(days=1)
    subscription = await create_subscription(
        save_fixture,
        status=SubscriptionStatus.active,
        product=product,
        customer=customer,
        current_period_end=stale,
        created_at=stale,
    )

    with pytest.raises(SubscriptionsCurrentPeriodEndInvariantError) as exc_info:
        await invariant.check()
    assert exc_info.value.context == {
        "count": 1,
        "subscriptions": {"ids": [subscription.id], "has_more": False},
    }


@pytest.mark.asyncio
async def test_failure_over_limit(
    invariant: SubscriptionsCurrentPeriodEndInvariant,
    save_fixture: SaveFixture,
    product: Product,
    customer: Customer,
) -> None:
    stale = utc_now() - timedelta(days=1)
    for _ in range(15):
        await create_subscription(
            save_fixture,
            status=SubscriptionStatus.active,
            product=product,
            customer=customer,
            current_period_end=stale,
            created_at=stale,
            modified_at=stale,
        )

    with pytest.raises(SubscriptionsCurrentPeriodEndInvariantError) as exc_info:
        await invariant.check()
    assert exc_info.value.context["count"] == 15
    assert len(exc_info.value.context["subscriptions"]["ids"]) == 10
    assert exc_info.value.context["subscriptions"]["has_more"] is True


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


@pytest.mark.asyncio
async def test_success_just_created_subscription(
    invariant: SubscriptionsCurrentPeriodEndInvariant,
    save_fixture: SaveFixture,
    product: Product,
    customer: Customer,
) -> None:
    """The dunning recovery race: overdue by days, but written seconds ago."""
    await create_subscription(
        save_fixture,
        status=SubscriptionStatus.active,
        product=product,
        customer=customer,
        current_period_end=utc_now() - timedelta(days=7),
    )

    await invariant.check()


@pytest.mark.asyncio
async def test_success_just_updated_subscription(
    session: AsyncSession,
    invariant: SubscriptionsCurrentPeriodEndInvariant,
    save_fixture: SaveFixture,
    product: Product,
    customer: Customer,
) -> None:
    """The grace relies on any write bumping modified_at."""
    stale = utc_now() - timedelta(days=7)
    subscription = await create_subscription(
        save_fixture,
        status=SubscriptionStatus.active,
        product=product,
        customer=customer,
        current_period_end=stale,
        created_at=stale,
        modified_at=stale,
    )

    repository = SubscriptionRepository.from_session(session)
    await repository.update(subscription, update_dict={"user_metadata": {"key": "1"}})

    await invariant.check()
