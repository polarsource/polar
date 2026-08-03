from datetime import UTC, datetime, timedelta

import pytest
from pytest_mock import MockerFixture

from polar.benefit.grant.manual.scheduler import ManualGrantExpiryJobStore
from polar.kit.utils import utc_now
from polar.models import Customer, ManualGrant
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_manual_grant


@pytest.mark.asyncio
async def test_get_due_jobs_does_not_raise(mocker: MockerFixture) -> None:
    store = ManualGrantExpiryJobStore()
    mocker.patch.object(store, "_list_jobs_from_statement", return_value=[])

    jobs = store.get_due_jobs(utc_now())

    assert jobs == []


@pytest.mark.asyncio
async def test_get_due_jobs_reports_failures_to_sentry(
    mocker: MockerFixture,
) -> None:
    store = ManualGrantExpiryJobStore()
    error = RuntimeError("query failed")
    mocker.patch.object(store, "scheduling_statement", side_effect=error)
    capture_exception = mocker.patch(
        "polar.benefit.grant.manual.scheduler.sentry_sdk.capture_exception"
    )

    with pytest.raises(RuntimeError):
        store.get_due_jobs(utc_now())

    capture_exception.assert_called_once_with(error)


@pytest.mark.asyncio
async def test_scheduling_statement_eligibility(
    session: AsyncSession,
    save_fixture: SaveFixture,
    customer: Customer,
) -> None:
    """Only undeleted, unclaimed manual grants with an expiration are scheduled."""
    expires_at = datetime.now(UTC) + timedelta(days=1)

    eligible = await create_manual_grant(
        save_fixture, customer=customer, expires_at=expires_at
    )
    await create_manual_grant(save_fixture, customer=customer)  # no expiry

    claimed = await create_manual_grant(
        save_fixture, customer=customer, expires_at=expires_at
    )
    claimed.scheduler_locked_at = utc_now()
    await save_fixture(claimed)

    deleted = await create_manual_grant(
        save_fixture, customer=customer, expires_at=expires_at
    )
    deleted.set_deleted_at()
    await save_fixture(deleted)

    statement = ManualGrantExpiryJobStore.scheduling_statement().with_only_columns(
        ManualGrant.id
    )
    result = await session.execute(statement)

    assert set(result.scalars().all()) == {eligible.id}
