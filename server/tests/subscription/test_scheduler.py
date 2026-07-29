import re

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.dialects import postgresql
from sqlalchemy.sql import Select

from polar.kit.utils import utc_now
from polar.models import Subscription
from polar.subscription.scheduler import (
    SubscriptionJobStore,
    SubscriptionResumeJobStore,
    _SubscriptionScheduleJobStore,
)


def _compile_where(statement: Select[tuple[Subscription]]) -> str:
    compiled = str(
        statement.compile(
            dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}
        )
    )
    return compiled.split("WHERE", 1)[1]


def test_cycle_scheduling_statement_matches_partial_index_predicate() -> None:
    """The cycle scheduler's status filter must compile to a bare ``status IN (...)``
    so PostgreSQL can prove the partial index ``ix_subscriptions_cycle_schedule``
    predicate (``status IN ('trialing', 'active')``) is implied by the query.

    ``Subscription.active.is_(True)`` historically generated
    ``(status IN (...)) IS true``, which the planner cannot match against the
    partial index predicate, forcing a seq scan + disk sort. See commit ffc57e4ea.
    """
    where = _compile_where(SubscriptionJobStore.scheduling_statement())

    # The status filter must be a bare ``subscriptions.status IN (...)`` predicate.
    # ``active_statuses()`` returns a set, so the IN-list element order is not
    # stable across runs; match either ordering.
    bare_in = re.search(
        r"subscriptions\.status IN \((?:'active', 'trialing'|'trialing', 'active')\)",
        where,
    )
    assert bare_in is not None, (
        f"expected a bare subscriptions.status IN (...) predicate, got: {where}"
    )

    # The IS true wrapper around the status IN (...) predicate must be absent —
    # it breaks partial-index predicate implication in PostgreSQL.
    wrapped = re.search(r"\(subscriptions\.status IN \([^)]*\)\) IS true", where)
    assert wrapped is None, (
        f"status IN (...) must not be wrapped in IS true, got: {where}"
    )


def test_resume_scheduling_statement_matches_partial_index_predicate() -> None:
    """The resume scheduler's status filter must compile to ``status = 'paused'``
    to match the partial index ``ix_subscriptions_resume_schedule`` predicate."""
    where = _compile_where(SubscriptionResumeJobStore.scheduling_statement())

    assert "subscriptions.status = 'paused'" in where


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
