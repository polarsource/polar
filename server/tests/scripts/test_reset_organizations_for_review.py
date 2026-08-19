from typing import Any, Self
from unittest.mock import AsyncMock, MagicMock, call, patch
from uuid import uuid4

import pytest

import scripts.reset_organizations_for_review as script
from polar.organization.service import organization as organization_service
from polar.postgres import AsyncSession
from polar.worker import JobQueueManager, enqueue_job
from polar.worker._enqueue import _job_queue_manager
from scripts.reset_organizations_for_review import _load_organizations


@pytest.mark.asyncio
async def test_load_organizations_locks_targets(session: AsyncSession) -> None:
    organization_ids = [uuid4(), uuid4()]
    get_by_id = AsyncMock(side_effect=[None, None])

    with patch(
        "scripts.reset_organizations_for_review.OrganizationRepository.from_session"
    ) as from_session:
        from_session.return_value.get_by_id = get_by_id
        await _load_organizations(session, organization_ids)

    assert get_by_id.await_args_list == [
        call(
            organization_ids[0],
            include_blocked=True,
            for_update=True,
        ),
        call(
            organization_ids[1],
            include_blocked=True,
            for_update=True,
        ),
    ]


class _FakeSession:
    def __init__(self, events: list[str]) -> None:
        self.events = events

    async def __aenter__(self) -> Self:
        return self

    async def __aexit__(self, *args: object) -> None: ...

    async def commit(self) -> None:
        self.events.append("commit")


class _FakeRedis:
    async def __aenter__(self) -> Self:
        return self

    async def __aexit__(self, *args: object) -> None: ...


def test_execute_flushes_enqueued_jobs_after_commit() -> None:
    """The script runs outside the API and worker, so it must open its own
    JobQueueManager: the reset enqueues ``payout.cancel_held_payouts``, which
    raises without one. The flush must happen after the commit."""
    events: list[str] = []
    session = _FakeSession(events)
    organization = MagicMock()
    flushed_actors: list[str] = []

    async def reset_onboarding_for_review(*args: Any, **kwargs: Any) -> Any:
        enqueue_job("payout.cancel_held_payouts", account_id=None)
        return organization

    async def flush(self: JobQueueManager, broker: Any, redis: Any) -> None:
        events.append("flush")
        flushed_actors.extend(actor for actor, _, _, _ in self._enqueued_jobs)
        self.reset()

    _job_queue_manager.set(None)

    with (
        patch.object(
            script, "create_async_engine", return_value=MagicMock(dispose=AsyncMock())
        ),
        patch.object(script, "create_async_sessionmaker", return_value=lambda: session),
        patch.object(script, "create_redis", return_value=_FakeRedis()),
        patch.object(
            script,
            "_load_organizations",
            AsyncMock(return_value=[(organization.id, organization)]),
        ),
        patch.object(script, "_show_plan", return_value=True),
        patch.object(
            organization_service,
            "reset_onboarding_for_review",
            reset_onboarding_for_review,
        ),
        patch.object(JobQueueManager, "flush", flush),
    ):
        script.reset_organizations_for_review(
            organization_ids=[uuid4()], execute=True, reset_by="test"
        )

    assert events == ["commit", "flush"]
    assert flushed_actors == ["payout.cancel_held_payouts"]
