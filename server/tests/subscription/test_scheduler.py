from datetime import timedelta

import pytest
from pytest_mock import MockerFixture

from polar.kit.db.postgres import AsyncSession
from polar.kit.utils import utc_now
from polar.models import Customer, Product, Subscription
from polar.models.subscription import SubscriptionStatus
from polar.subscription.scheduler import (
    SubscriptionJobStore,
    SubscriptionResumeJobStore,
    _next_run_time,
    _SubscriptionScheduleJobStore,
)
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_subscription


@pytest.mark.asyncio
async def test_cycle_scheduler_only_selects_due_billable_subscriptions(
    session: AsyncSession,
    save_fixture: SaveFixture,
    product: Product,
    customer: Customer,
) -> None:
    now = utc_now()
    past_period_end = now - timedelta(days=1)
    future_period_end = now + timedelta(days=1)

    active_due = await create_subscription(
        save_fixture,
        product=product,
        customer=customer,
        status=SubscriptionStatus.active,
        current_period_start=past_period_end - timedelta(days=30),
        current_period_end=past_period_end,
    )
    past_due = await create_subscription(
        save_fixture,
        product=product,
        customer=customer,
        status=SubscriptionStatus.past_due,
        current_period_start=past_period_end - timedelta(days=30),
        current_period_end=past_period_end,
    )
    await create_subscription(
        save_fixture,
        product=product,
        customer=customer,
        status=SubscriptionStatus.active,
        current_period_end=future_period_end,
    )
    await create_subscription(
        save_fixture,
        product=product,
        customer=customer,
        status=SubscriptionStatus.canceled,
        current_period_start=past_period_end - timedelta(days=30),
        current_period_end=past_period_end,
    )

    statement = (
        SubscriptionJobStore.scheduling_statement()
        .where(_next_run_time() <= now)
        .with_only_columns(Subscription.id)
    )
    result = await session.execute(statement)
    assert set(result.scalars()) == {active_due.id, past_due.id}


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "store_class", [SubscriptionJobStore, SubscriptionResumeJobStore]
)
async def test_get_due_jobs_does_not_raise(
    store_class: type[_SubscriptionScheduleJobStore],
    mocker: MockerFixture,
) -> None:
    """``get_due_jobs`` must build and run its query without raising.

    Guards each store's instance query path — previously uncovered, since
    tests only exercised the class-level ``scheduling_statement()``.
    """
    store = store_class()
    mocker.patch.object(store, "_list_jobs_from_statement", return_value=[])

    jobs = store.get_due_jobs(utc_now())

    assert jobs == []


@pytest.mark.asyncio
async def test_get_due_jobs_reports_failures_to_sentry(
    mocker: MockerFixture,
) -> None:
    """A failing query is captured to Sentry and re-raised, so a broken store
    can't degrade silently behind APScheduler's warn-and-retry."""
    store = SubscriptionJobStore()
    error = RuntimeError("query failed")
    mocker.patch.object(store, "scheduling_statement", side_effect=error)
    capture_exception = mocker.patch(
        "polar.subscription.scheduler.sentry_sdk.capture_exception"
    )

    with pytest.raises(RuntimeError):
        store.get_due_jobs(utc_now())

    capture_exception.assert_called_once_with(error)
