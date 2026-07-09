import pytest
from pytest_mock import MockerFixture

from polar.kit.utils import utc_now
from polar.subscription.scheduler import SubscriptionJobStore


@pytest.mark.asyncio
async def test_get_due_jobs_does_not_raise(
    mocker: MockerFixture,
) -> None:
    """``get_due_jobs`` must build and run its query without raising.

    Guards the job store's instance query path — previously uncovered, since
    tests only exercised the class-level ``scheduling_statement()``.
    """
    store = SubscriptionJobStore()
    mocker.patch.object(store, "_list_jobs_from_statement", return_value=[])

    jobs = store.get_due_jobs(utc_now())

    assert jobs == []
