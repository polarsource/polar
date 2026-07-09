import pytest
from pytest_mock import MockerFixture

from polar.kit.utils import utc_now
from polar.subscription.scheduler import (
    SubscriptionJobStore,
    SubscriptionResumeJobStore,
    _SubscriptionScheduleJobStore,
)


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
