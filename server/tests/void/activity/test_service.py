import json
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID

import pytest
from pytest_mock import MockerFixture
from sqlalchemy import select
from temporalio.client import Client

from polar.config import settings
from polar.models import Organization, VoidActivity, VoidEvent
from polar.postgres import AsyncSession
from polar.void.activity.schemas import ActivityCreate
from polar.void.activity.service import (
    ActivityService,
    event_metadata,
    span_key_of,
    summarize_events,
)
from polar.void.activity.service import activity as activity_service
from polar.void.activity.taxonomy import PENDING, TAXONOMY, UNLABELED
from polar.void.activity.typesafe import Classification, TypeSafeError
from polar.void.event.schemas import EventCreate, EventSource
from polar.void.event.service import event as event_service
from tests.fixtures.database import SaveFixture
from tests.void.conftest import VERSION, activate_version

LABELED = Classification(
    activity="implement",
    confidence=0.91,
    probabilities={"implement": 0.91, "plan": 0.09},
    waste=0.1,
    model="jev-latest",
)


class Fixed:
    def __init__(self, result: Classification) -> None:
        self.result = result

    async def classify(self, state: object) -> Classification:
        return self.result


def completion(
    external_id: str,
    *,
    call_id: str = "call_1",
    run_id: str | None = "run_1",
    cost: float = 0.02,
    step: int = 0,
    tools: list[str] | None = None,
    tool_errors: list[str] | None = None,
) -> EventCreate:
    metadata: dict[str, object] = {
        "call_id": call_id,
        "model": "anthropic/claude-sonnet",
        "input_tokens": 10,
        "output_tokens": 4,
        "cost": cost,
        "step": step,
        "finish_reason": "stop",
        "tools": tools or [],
        "tool_errors": tool_errors or [],
        "has_text": not tools,
    }
    if run_id is not None:
        metadata["run_id"] = run_id
    return EventCreate(
        external_id=external_id,
        name="llm.completion",
        timestamp=datetime(2026, 1, 1, tzinfo=UTC),
        metadata=metadata,
    )


async def definition(
    session: AsyncSession,
    organization: Organization,
    save_fixture: SaveFixture,
) -> VoidActivity:
    await activate_version(save_fixture, organization)
    return await activity_service.create(
        session,
        organization.id,
        ActivityCreate(
            version_id=VERSION,
            slug="agent",
            event_name="llm.completion",
            group_by="call_id",
            run_by="run_id",
            taxonomy=TAXONOMY,
        ),
    )


@pytest.mark.asyncio
class TestClassify:
    async def test_labels_a_span_and_skips_unchanged_state(
        self,
        session: AsyncSession,
        organization: Organization,
        save_fixture: SaveFixture,
    ) -> None:
        created = await definition(session, organization, save_fixture)
        await event_service.ingest(
            session,
            organization.id,
            [completion("e1"), completion("e2", cost=0.03)],
            EventSource.user,
        )
        service = ActivityService(Fixed(LABELED))
        first = await service.classify_span(
            session, organization.id, created.id, "call_1"
        )
        assert first is not None
        assert first.activity == "implement"
        assert first.activity_confidence == 0.91
        assert first.waste == 0.1
        assert first.cost == pytest.approx(0.05)
        assert first.input_tokens == 20
        assert first.event_count == 2
        assert first.run_key == "run_1"
        classified_at = first.classified_at
        second = await service.classify_span(
            session, organization.id, created.id, "call_1"
        )
        assert second is first
        assert second.classified_at == classified_at

    async def test_below_threshold_is_unlabeled_and_errors_stay_pending(
        self,
        session: AsyncSession,
        organization: Organization,
        save_fixture: SaveFixture,
    ) -> None:
        created = await definition(session, organization, save_fixture)
        await event_service.ingest(
            session, organization.id, [completion("e1")], EventSource.user
        )
        unlabeled = await ActivityService(
            Fixed(
                Classification(
                    activity="plan",
                    confidence=0.4,
                    probabilities={"plan": 0.4},
                    waste=0,
                    model="jev-latest",
                )
            )
        ).classify_span(session, organization.id, created.id, "call_1")
        assert unlabeled is not None
        assert unlabeled.activity == UNLABELED

        class Boom:
            async def classify(self, state: object) -> Classification:
                raise TypeSafeError("down")

        await event_service.ingest(
            session, organization.id, [completion("e2", cost=0.01)], EventSource.user
        )
        with pytest.raises(TypeSafeError):
            await ActivityService(Boom()).classify_span(
                session, organization.id, created.id, "call_1"
            )
        pending = await activity_service.get_span(session, organization.id, "call_1")
        assert pending is not None
        assert pending.activity == PENDING

    async def test_report_shares_and_retry_waste(
        self,
        session: AsyncSession,
        organization: Organization,
        save_fixture: SaveFixture,
    ) -> None:
        created = await definition(session, organization, save_fixture)
        await event_service.ingest(
            session,
            organization.id,
            [
                completion("ok", call_id="a", cost=0.08),
                completion(
                    "loop", call_id="b", cost=0.02, step=1, tools=["apply_patch"]
                ),
            ],
            EventSource.user,
        )
        await ActivityService(Fixed(LABELED)).classify_span(
            session, organization.id, created.id, "a"
        )
        await ActivityService(
            Fixed(
                Classification(
                    activity="retry",
                    confidence=0.8,
                    probabilities={"retry": 0.8},
                    waste=0.2,
                    model="jev-latest",
                )
            )
        ).classify_span(session, organization.id, created.id, "b")
        report = await activity_service.report(session, organization.id)
        by_slug = {share.slug: share for share in report.by_activity}
        assert by_slug["implement"].share == pytest.approx(0.8)
        assert by_slug["retry"].waste_cost == pytest.approx(0.02)
        assert report.totals.labeled_cost == pytest.approx(0.10)
        assert report.runs[0].run_key == "run_1"
        assert report.runs[0].spans == 2


def test_summarize_rolls_up_tools_not_arguments() -> None:
    def event(external_id: str, metadata: dict[str, object]) -> object:
        return type(
            "E",
            (),
            {
                "external_id": external_id,
                "payload": {
                    "name": "llm.completion",
                    "external_id": external_id,
                    "external_identity_id": "agent-1",
                    "metadata": json.dumps(metadata),
                },
            },
        )()

    events = [
        event(
            "a",
            {
                "call_id": "call_1",
                "run_id": "run_1",
                "model": "anthropic/claude-sonnet",
                "step": 0,
                "finish_reason": "tool-calls",
                "input_tokens": 10,
                "output_tokens": 2,
                "cost": 0.01,
                "tools": ["read_file", "apply_patch"],
                "tool_errors": ["apply_patch"],
                "has_text": False,
            },
        ),
        event(
            "b",
            {
                "call_id": "call_1",
                "model": "anthropic/claude-sonnet",
                "step": 1,
                "finish_reason": "stop",
                "input_tokens": 4,
                "output_tokens": 8,
                "cost": 0.02,
                "tools": ["apply_patch"],
                "tool_errors": [],
                "has_text": True,
            },
        ),
    ]
    state = summarize_events(events)  # type: ignore[arg-type]
    assert state["span"]["tools"] == ["read_file", "apply_patch"]
    assert state["span"]["tool_errors"] == ["apply_patch"]
    assert state["span"]["shape"] == "mixed"
    assert state["span"]["has_text"] is True
    assert state["span"]["tags"] == {"run_id": "run_1"}
    assert "path" not in state["events"][0]


def test_span_key_reads_stringified_metadata() -> None:
    payload = {
        "external_id": "fallback",
        "metadata": '{"call_id": "call_9"}',
    }
    assert event_metadata(payload)["call_id"] == "call_9"
    assert span_key_of(payload, "call_id") == "call_9"
    assert span_key_of({"external_id": "only", "metadata": "{}"}, "call_id") == "only"


async def _events(session: AsyncSession, organization_id: UUID) -> list[VoidEvent]:
    return list(
        (
            await session.execute(
                select(VoidEvent).where(VoidEvent.organization_id == organization_id)
            )
        )
        .scalars()
        .all()
    )


@pytest.mark.asyncio
async def test_touch_events_seeds_pending_and_starts_workflow(
    session: AsyncSession,
    organization: Organization,
    save_fixture: SaveFixture,
    mocker: MockerFixture,
) -> None:
    mocker.patch.object(settings, "TYPESAFE_AI_KEY", "test-key")
    created = await definition(session, organization, save_fixture)
    await event_service.ingest(
        session, organization.id, [completion("e1")], EventSource.user
    )
    temporal = MagicMock(spec=Client)
    temporal.start_workflow = AsyncMock()
    await activity_service.touch_events(
        session, temporal, await _events(session, organization.id)
    )
    await session.flush()
    pending = await activity_service.get_span(session, organization.id, "call_1")
    assert pending is not None
    assert pending.activity == PENDING
    assert pending.cost == pytest.approx(0.02)
    temporal.start_workflow.assert_awaited_once()
    assert temporal.start_workflow.call_args.kwargs["id"] == (
        f"polar-void-activity-span-{organization.id}-{created.id}-call_1"
    )


@pytest.mark.asyncio
async def test_touch_events_skips_without_typesafe_key(
    session: AsyncSession,
    organization: Organization,
    save_fixture: SaveFixture,
    mocker: MockerFixture,
) -> None:
    mocker.patch.object(settings, "TYPESAFE_AI_KEY", None)
    await definition(session, organization, save_fixture)
    await event_service.ingest(
        session, organization.id, [completion("e1")], EventSource.user
    )
    temporal = MagicMock(spec=Client)
    temporal.start_workflow = AsyncMock()
    await activity_service.touch_events(
        session, temporal, await _events(session, organization.id)
    )
    await session.flush()
    assert await activity_service.get_span(session, organization.id, "call_1") is None
    temporal.start_workflow.assert_not_awaited()
