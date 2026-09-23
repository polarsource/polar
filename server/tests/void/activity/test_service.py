from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest
from pytest_mock import MockerFixture
from sqlalchemy import select

from polar.config import settings
from polar.kit.utils import utc_now
from polar.models import Event as EventModel
from polar.models import Organization, VoidActivitySpan, VoidDeployment
from polar.postgres import AsyncSession
from polar.void.activity.repository import ActivitySpanRepository
from polar.void.activity.service import (
    DEBOUNCE,
    RETRY_BACKOFF,
    ActivityService,
    event_metadata,
    span_key_of,
    summarize_events,
)
from polar.void.activity.service import activity as activity_service
from polar.void.activity.taxonomy import PENDING, UNLABELED
from polar.void.activity.typesafe import Classification, TypeSafeError
from polar.void.event.schemas import EventCreate, EventSource
from polar.void.event.service import event as event_service
from tests.fixtures.database import SaveFixture
from tests.void.conftest import VERSION, activate_version

LABELED = Classification(
    activity="implement", confidence=0.91, waste=0.1, model="jev-latest"
)
RETRY = Classification(activity="retry", confidence=0.8, waste=0.2, model="jev-latest")


class Fixed:
    def __init__(self, result: Classification) -> None:
        self.result = result
        self.calls = 0

    async def classify(self, state: object) -> Classification:
        self.calls += 1
        return self.result


class Boom:
    async def classify(self, state: object) -> Classification:
        raise TypeSafeError("down")


def completion(
    external_id: str,
    *,
    call_id: str = "call_1",
    cost: float = 0.02,
    step: int = 0,
    tools: list[str] | None = None,
    tool_errors: list[str] | None = None,
) -> EventCreate:
    return EventCreate(
        external_id=external_id,
        name="llm.completion",
        timestamp=datetime(2026, 1, 1, tzinfo=UTC),
        metadata={
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
        },
    )


async def deploy_classifier(
    save_fixture: SaveFixture, organization: Organization
) -> VoidDeployment:
    """An active deployment whose configuration declares one classifier."""
    return await activate_version(
        save_fixture,
        organization,
        configuration={
            "activities": [
                {"slug": "agent", "event": "llm.completion", "group_by": "call_id"}
            ]
        },
    )


async def ingest(
    session: AsyncSession, organization: Organization, *events: EventCreate
) -> list[EventModel]:
    await event_service.ingest(session, organization.id, list(events), EventSource.user)
    return list(
        (
            await session.execute(
                select(EventModel).where(EventModel.organization_id == organization.id)
            )
        )
        .scalars()
        .all()
    )


async def touch(
    session: AsyncSession, organization: Organization, *events: EventCreate
) -> None:
    await activity_service.touch_events(
        session, await ingest(session, organization, *events)
    )
    await session.flush()


async def span_row(
    session: AsyncSession, organization_id: UUID, span_key: str
) -> VoidActivitySpan | None:
    return await ActivitySpanRepository.from_session(session).get_span(
        organization_id, VERSION, span_key
    )


@pytest.fixture(autouse=True)
def typesafe_key(mocker: MockerFixture) -> None:
    mocker.patch.object(settings, "TYPESAFE_AI_KEY", "test-key")


@pytest.mark.asyncio
class TestTouch:
    async def test_seeds_a_pending_span_and_debounces_it(
        self,
        session: AsyncSession,
        organization: Organization,
        save_fixture: SaveFixture,
    ) -> None:
        await deploy_classifier(save_fixture, organization)
        before = utc_now()
        await touch(session, organization, completion("e1"))
        pending = await span_row(session, organization.id, "call_1")
        assert pending is not None
        assert pending.activity == PENDING
        assert pending.group_by == "call_id"
        assert pending.cost == pytest.approx(0.02)
        assert pending.due_at is not None
        assert pending.due_at >= before + DEBOUNCE
        first_due = pending.due_at
        await touch(session, organization, completion("e2"))
        assert pending.due_at is not None
        assert pending.due_at >= first_due
        assert (
            await session.scalar(
                select(VoidActivitySpan.id).where(
                    VoidActivitySpan.organization_id == organization.id
                )
            )
            == pending.id
        )

    async def test_ignores_events_no_classifier_declares(
        self,
        session: AsyncSession,
        organization: Organization,
        save_fixture: SaveFixture,
    ) -> None:
        deployment = await deploy_classifier(save_fixture, organization)
        deployment.configuration = {}
        await touch(session, organization, completion("e1"))
        assert await span_row(session, organization.id, "call_1") is None

    async def test_skips_without_typesafe_key(
        self,
        session: AsyncSession,
        organization: Organization,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
    ) -> None:
        mocker.patch.object(settings, "TYPESAFE_AI_KEY", None)
        await deploy_classifier(save_fixture, organization)
        await touch(session, organization, completion("e1"))
        assert await span_row(session, organization.id, "call_1") is None


@pytest.mark.asyncio
class TestSweep:
    async def test_labels_due_spans_and_skips_unchanged_state(
        self,
        session: AsyncSession,
        organization: Organization,
        save_fixture: SaveFixture,
    ) -> None:
        await deploy_classifier(save_fixture, organization)
        await touch(
            session, organization, completion("e1"), completion("e2", cost=0.03)
        )
        span = await span_row(session, organization.id, "call_1")
        assert span is not None
        span.due_at = utc_now() - timedelta(seconds=1)
        await session.flush()
        classifier = Fixed(LABELED)
        service = ActivityService(classifier)
        assert await service.classify_due(session) == 1
        assert span.activity == "implement"
        assert span.activity_confidence == 0.91
        assert span.waste == 0.1
        assert span.cost == pytest.approx(0.05)
        assert span.input_tokens == 20
        assert span.event_count == 2
        assert span.due_at is None
        classified_at = span.classified_at
        span.due_at = utc_now() - timedelta(seconds=1)
        await session.flush()
        assert await service.classify_due(session) == 1
        assert classifier.calls == 1
        assert span.classified_at == classified_at
        assert span.due_at is None

    async def test_leaves_undue_spans_alone(
        self,
        session: AsyncSession,
        organization: Organization,
        save_fixture: SaveFixture,
    ) -> None:
        await deploy_classifier(save_fixture, organization)
        await touch(session, organization, completion("e1"))
        classifier = Fixed(LABELED)
        assert await ActivityService(classifier).classify_due(session) == 0
        assert classifier.calls == 0

    async def test_below_threshold_is_unlabeled(
        self,
        session: AsyncSession,
        organization: Organization,
        save_fixture: SaveFixture,
    ) -> None:
        await deploy_classifier(save_fixture, organization)
        await touch(session, organization, completion("e1"))
        span = await span_row(session, organization.id, "call_1")
        assert span is not None
        await ActivityService(
            Fixed(Classification("plan", confidence=0.4, waste=0, model="jev"))
        ).classify_span(session, span)
        assert span.activity == UNLABELED

    async def test_classifier_outage_pushes_the_span_back(
        self,
        session: AsyncSession,
        organization: Organization,
        save_fixture: SaveFixture,
    ) -> None:
        await deploy_classifier(save_fixture, organization)
        await touch(session, organization, completion("e1"))
        span = await span_row(session, organization.id, "call_1")
        assert span is not None
        span.due_at = utc_now() - timedelta(seconds=1)
        await session.flush()
        before = utc_now()
        assert await ActivityService(Boom()).classify_due(session) == 1
        assert span.activity == PENDING
        assert span.due_at is not None
        assert span.due_at >= before + RETRY_BACKOFF - timedelta(seconds=1)

    async def test_report_shares_and_retry_waste(
        self,
        session: AsyncSession,
        organization: Organization,
        save_fixture: SaveFixture,
    ) -> None:
        await deploy_classifier(save_fixture, organization)
        await touch(
            session,
            organization,
            completion("ok", call_id="a", cost=0.08),
            completion("loop", call_id="b", cost=0.02, step=1, tools=["apply_patch"]),
        )
        a = await span_row(session, organization.id, "a")
        b = await span_row(session, organization.id, "b")
        assert a is not None
        assert b is not None
        await ActivityService(Fixed(LABELED)).classify_span(session, a)
        await ActivityService(Fixed(RETRY)).classify_span(session, b)
        report = await activity_service.report(session, organization.id)
        by_slug = {share.slug: share for share in report.by_activity}
        assert by_slug["implement"].share == pytest.approx(0.8)
        assert by_slug["retry"].waste_cost == pytest.approx(0.02)
        assert report.totals.labeled_cost == pytest.approx(0.10)
        detail = await activity_service.get_span(session, organization.id, "a")
        assert detail is not None
        assert detail.event_ids == ["ok"]


def test_summarize_rolls_up_tools_not_arguments() -> None:
    def event(external_id: str, metadata: dict[str, object]) -> object:
        return EventModel(
            id=uuid4(),
            organization_id=uuid4(),
            external_id=external_id,
            name="llm.completion",
            source="user",
            external_identity_id="agent-1",
            timestamp=utc_now(),
            ingested_at=utc_now(),
            user_metadata=metadata,
        )

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
