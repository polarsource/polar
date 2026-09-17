from __future__ import annotations

import hashlib
import json
from collections import defaultdict
from collections.abc import Mapping, Sequence
from datetime import datetime
from typing import Any
from uuid import UUID

import structlog
from temporalio.client import Client
from temporalio.exceptions import WorkflowAlreadyStartedError

from polar.kit.utils import utc_now
from polar.models import (
    VoidActivity,
    VoidActivitySpan,
    VoidEvent,
)
from polar.postgres import AsyncReadSession, AsyncSession
from polar.void.organization.service import organization as organization_service
from polar.void.temporal import TASK_QUEUE

from .repository import (
    ActivityEventRepository,
    ActivityRepository,
    ActivitySpanRepository,
)
from .schemas import (
    ActivityCreate,
    ActivityGroup,
    ActivityReport,
    ActivityRun,
    ActivityShare,
    ActivityTotals,
    ActivityWindow,
    DeployActivity,
)
from .schemas import (
    ActivitySpan as ActivitySpanSchema,
)
from .taxonomy import (
    ACTIVITY_CRITERIA,
    CONFIDENCE_THRESHOLD,
    PENDING,
    SPAN_EVENT_CAP,
    TAXONOMY,
    UNLABELED,
)
from .typesafe import Classification, Classifier, TypeSafeClassifier, TypeSafeError
from .workflows import ClassifySpanInput, ClassifySpanWorkflow

log = structlog.get_logger()


def same_definition(wanted: DeployActivity, current: VoidActivity) -> bool:
    return (
        current.event_name == wanted.event
        and current.group_by == wanted.group_by
        and current.run_by == wanted.run_by
        and current.taxonomy == wanted.taxonomy
    )


def event_metadata(payload: Mapping[str, Any]) -> dict[str, Any]:
    raw = payload.get("metadata")
    if isinstance(raw, str):
        loaded = json.loads(raw)
        return loaded if isinstance(loaded, dict) else {}
    return dict(raw) if isinstance(raw, dict) else {}


def span_key_of(payload: Mapping[str, Any], group_by: str) -> str:
    meta = event_metadata(payload)
    value = meta.get(group_by)
    if isinstance(value, str) and value:
        return value
    return str(payload["external_id"])


def _number(value: Any) -> float | None:
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, int | float):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value)
        except ValueError:
            return None
    return None


def _int(value: Any) -> int:
    number = _number(value)
    return int(number) if number is not None else 0


def _names(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, str) and item]


def _flag(value: Any) -> bool | None:
    return value if isinstance(value, bool) else None


def summarize_events(events: Sequence[VoidEvent]) -> dict[str, Any]:
    rows: list[dict[str, Any]] = []
    for event in events:
        meta = event_metadata(event.payload)
        rows.append(
            {
                "external_id": event.external_id,
                "step": meta.get("step"),
                "model": meta.get("model"),
                "finish_reason": meta.get("finish_reason"),
                "input_tokens": _int(meta.get("input_tokens")),
                "output_tokens": _int(meta.get("output_tokens")),
                "cost": _number(meta.get("cost")),
                "fallback_from": meta.get("fallback_from"),
                "tools": _names(meta.get("tools")),
                "tool_errors": _names(meta.get("tool_errors")),
                "has_text": _flag(meta.get("has_text")),
            }
        )
    if len(rows) > SPAN_EVENT_CAP:
        head, tail = rows[0], rows[-1]
        middle = sorted(
            rows[1:-1],
            key=lambda row: (row["cost"] is None, -(row["cost"] or 0)),
        )[: SPAN_EVENT_CAP - 2]
        kept = {id(head), id(tail), *(id(row) for row in middle)}
        rows = [row for row in rows if id(row) in kept]
    first = events[0]
    last = events[-1]
    meta = event_metadata(first.payload)
    tools: list[str] = []
    tool_errors: list[str] = []
    seen_tools: set[str] = set()
    seen_errors: set[str] = set()
    for row in rows:
        for name in row["tools"]:
            if name not in seen_tools:
                seen_tools.add(name)
                tools.append(name)
        for name in row["tool_errors"]:
            if name not in seen_errors:
                seen_errors.add(name)
                tool_errors.append(name)
    has_text = any(row["has_text"] is True for row in rows)
    has_tools = bool(tools)
    shape = (
        "mixed"
        if has_text and has_tools
        else "text"
        if has_text
        else "tools"
        if has_tools
        else "empty"
    )
    return {
        "taxonomy": TAXONOMY,
        "span": {
            "call_id": span_key_of(first.payload, "call_id"),
            "external_identity_id": first.payload.get("external_identity_id"),
            "event_name": first.payload.get("name"),
            "event_count": len(events),
            "models": sorted(
                {row["model"] for row in rows if isinstance(row["model"], str)}
            ),
            "finish_reasons": [
                row["finish_reason"]
                for row in rows
                if isinstance(row["finish_reason"], str)
            ],
            "steps": [row["step"] for row in rows if row["step"] is not None],
            "tools": tools,
            "tool_errors": tool_errors,
            "has_text": has_text,
            "shape": shape,
            "input_tokens": sum(row["input_tokens"] for row in rows),
            "output_tokens": sum(row["output_tokens"] for row in rows),
            "cost": sum(row["cost"] or 0 for row in rows) or None,
            "tags": {
                key: value
                for key, value in meta.items()
                if key
                not in {
                    "model",
                    "provider",
                    "input_tokens",
                    "output_tokens",
                    "cost",
                    "cost_source",
                    "call_id",
                    "step",
                    "finish_reason",
                    "fallback_from",
                    "latency_ms",
                    "generation_id",
                    "response_id",
                    "credits",
                    "tools",
                    "tool_errors",
                    "has_text",
                }
            },
        },
        "events": rows,
    }


def state_hash(state: Mapping[str, Any]) -> str:
    encoded = json.dumps(state, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(encoded.encode()).hexdigest()


def _shares(spans: Sequence[VoidActivitySpan]) -> list[ActivityShare]:
    labeled = [span for span in spans if span.activity in ACTIVITY_CRITERIA]
    labeled_cost = sum(span.cost or 0 for span in labeled)
    grouped: dict[str, list[VoidActivitySpan]] = defaultdict(list)
    for span in labeled:
        grouped[span.activity].append(span)
    shares: list[ActivityShare] = []
    for slug in ACTIVITY_CRITERIA:
        bucket = grouped.get(slug, [])
        cost = sum(span.cost or 0 for span in bucket)
        waste_cost = sum(
            (span.cost or 0) * (span.waste or 0) for span in bucket if slug != "retry"
        )
        if slug == "retry":
            waste_cost = cost
        shares.append(
            ActivityShare(
                slug=slug,
                cost=cost,
                share=(cost / labeled_cost) if labeled_cost else 0,
                spans=len(bucket),
                waste_cost=waste_cost,
            )
        )
    return [share for share in shares if share.spans]


def _totals(spans: Sequence[VoidActivitySpan]) -> ActivityTotals:
    cost = sum(span.cost or 0 for span in spans)
    pending = sum(span.cost or 0 for span in spans if span.activity == PENDING)
    unlabeled = sum(span.cost or 0 for span in spans if span.activity == UNLABELED)
    return ActivityTotals(
        cost=cost,
        labeled_cost=cost - pending - unlabeled,
        unlabeled_cost=unlabeled,
        pending_cost=pending,
    )


class ActivityService:
    def __init__(self, classifier: Classifier | None = None) -> None:
        self.classifier = classifier or TypeSafeClassifier()

    async def list(
        self, session: AsyncReadSession, organization_id: UUID
    ) -> Sequence[VoidActivity]:
        return await ActivityRepository.from_session(session).list(organization_id)

    async def list_for_version(
        self, session: AsyncReadSession, organization_id: UUID, version_id: str
    ) -> Sequence[VoidActivity]:
        return await ActivityRepository.from_session(session).list_for_version(
            organization_id, version_id
        )

    async def create(
        self,
        session: AsyncSession,
        organization_id: UUID,
        create_schema: ActivityCreate,
    ) -> VoidActivity:
        row = VoidActivity(
            slug=create_schema.slug,
            version_id=create_schema.version_id,
            event_name=create_schema.event_name,
            group_by=create_schema.group_by,
            run_by=create_schema.run_by,
            taxonomy=create_schema.taxonomy,
            organization_id=organization_id,
        )
        session.add(row)
        await session.flush()
        return row

    async def report(
        self,
        session: AsyncReadSession,
        organization_id: UUID,
        *,
        identity: str | None = None,
        start: datetime | None = None,
        end: datetime | None = None,
        group: ActivityGroup = "run",
    ) -> ActivityReport:
        version_id = await organization_service.active_version(session, organization_id)
        if version_id is None:
            return ActivityReport(
                taxonomy=TAXONOMY,
                window=ActivityWindow(start=start, end=end),
                totals=_totals([]),
                by_activity=[],
                runs=[],
            )
        spans = await ActivitySpanRepository.from_session(session).list_spans(
            organization_id,
            version_id=version_id,
            identity=identity,
            start=start,
            end=end,
        )
        runs: list[ActivityRun] = []
        if group == "run":
            by_run: dict[str, list[VoidActivitySpan]] = defaultdict(list)
            for span in spans:
                if span.run_key:
                    by_run[span.run_key].append(span)
            runs = [
                ActivityRun(
                    run_key=key,
                    cost=sum(span.cost or 0 for span in bucket),
                    by_activity=_shares(bucket),
                    spans=len(bucket),
                )
                for key, bucket in sorted(by_run.items())
            ]
        return ActivityReport(
            taxonomy=TAXONOMY,
            window=ActivityWindow(start=start, end=end),
            totals=_totals(spans),
            by_activity=_shares(spans),
            runs=runs,
        )

    async def get_span(
        self,
        session: AsyncReadSession,
        organization_id: UUID,
        span_key: str,
    ) -> ActivitySpanSchema | None:
        version_id = await organization_service.active_version(session, organization_id)
        if version_id is None:
            return None
        span = await ActivitySpanRepository.from_session(session).get_span(
            organization_id, version_id, span_key
        )
        if span is None:
            return None
        definition = await ActivityRepository.from_session(session).get(
            organization_id, span.activity_id
        )
        event_ids: list[str] = []
        if definition is not None:
            events = await ActivityEventRepository.from_session(session).list_for_span(
                organization_id, definition.event_name, definition.group_by, span_key
            )
            event_ids = [event.external_id for event in events]
        return ActivitySpanSchema(
            span_key=span.span_key,
            activity=span.activity,
            activity_confidence=span.activity_confidence,
            waste=span.waste,
            cost=span.cost,
            input_tokens=span.input_tokens,
            output_tokens=span.output_tokens,
            event_count=span.event_count,
            event_name=span.event_name,
            external_identity_id=span.external_identity_id,
            run_key=span.run_key,
            first_event_at=span.first_event_at,
            last_event_at=span.last_event_at,
            classified_at=span.classified_at,
            event_ids=event_ids,
        )

    async def touch_events(
        self,
        session: AsyncReadSession,
        temporal: Client,
        events: Sequence[VoidEvent],
    ) -> None:
        by_org: dict[UUID, list[VoidEvent]] = defaultdict(list)
        for event in events:
            by_org[event.organization_id].append(event)
        for organization_id, org_events in by_org.items():
            version_id = await organization_service.active_version(
                session, organization_id
            )
            if version_id is None:
                continue
            definitions = await self.list_for_version(
                session, organization_id, version_id
            )
            await self.touch_spans(temporal, organization_id, definitions, org_events)

    async def touch_spans(
        self,
        temporal: Client,
        organization_id: UUID,
        definitions: Sequence[VoidActivity],
        events: Sequence[VoidEvent],
    ) -> None:
        if not definitions:
            return
        by_name = {definition.event_name: definition for definition in definitions}
        seen: set[tuple[UUID, str]] = set()
        for event in events:
            definition = by_name.get(str(event.payload.get("name")))
            if definition is None:
                continue
            key = span_key_of(event.payload, definition.group_by)
            pair = (definition.id, key)
            if pair in seen:
                continue
            seen.add(pair)
            try:
                await temporal.start_workflow(
                    ClassifySpanWorkflow.run,
                    ClassifySpanInput(str(organization_id), str(definition.id), key),
                    id=f"polar-void-activity-span-{organization_id}-{definition.id}-{key}",
                    task_queue=TASK_QUEUE,
                    start_signal="touch",
                )
            except WorkflowAlreadyStartedError:
                pass
            except Exception:
                log.exception(
                    "void.activity.touch_failed",
                    organization_id=str(organization_id),
                    span_key=key,
                )

    async def classify_span(
        self,
        session: AsyncSession,
        organization_id: UUID,
        activity_id: UUID,
        span_key: str,
    ) -> VoidActivitySpan | None:
        definition = await ActivityRepository.from_session(session).get(
            organization_id, activity_id
        )
        if definition is None:
            return None
        events = await ActivityEventRepository.from_session(session).list_for_span(
            organization_id, definition.event_name, definition.group_by, span_key
        )
        if not events:
            return None
        state = summarize_events(events)
        digest = state_hash(state)
        repository = ActivitySpanRepository.from_session(session)
        current = await repository.get_span(
            organization_id, definition.version_id, span_key
        )
        if (
            current is not None
            and current.state_hash == digest
            and current.activity != PENDING
        ):
            return current
        first = events[0]
        last = events[-1]
        meta = event_metadata(first.payload)
        run_key = meta.get(definition.run_by) if definition.run_by else None
        totals = state["span"]
        if current is None:
            current = VoidActivitySpan(
                activity_id=definition.id,
                version_id=definition.version_id,
                taxonomy=definition.taxonomy,
                span_key=span_key,
                event_name=definition.event_name,
                organization_id=organization_id,
                first_event_at=first.timestamp,
                last_event_at=last.timestamp,
                state_hash=digest,
                activity=PENDING,
            )
            session.add(current)
        current.external_identity_id = first.payload.get("external_identity_id")
        current.external_root_id = first.payload.get("external_root_id")
        current.run_key = run_key if isinstance(run_key, str) else None
        current.cost = totals["cost"]
        current.input_tokens = totals["input_tokens"]
        current.output_tokens = totals["output_tokens"]
        current.event_count = len(events)
        current.first_event_at = first.timestamp
        current.last_event_at = last.timestamp
        current.state_hash = digest
        try:
            result = await self.classifier.classify(state)
        except TypeSafeError:
            current.activity = PENDING
            await session.flush()
            raise
        self._apply(current, result)
        await session.flush()
        return current

    def _apply(self, span: VoidActivitySpan, result: Classification) -> None:
        if result.confidence >= CONFIDENCE_THRESHOLD:
            span.activity = result.activity
        else:
            span.activity = UNLABELED
        span.activity_confidence = result.confidence
        span.activity_probabilities = result.probabilities
        span.waste = result.waste
        span.model = result.model
        span.classified_at = utc_now()


activity = ActivityService()
