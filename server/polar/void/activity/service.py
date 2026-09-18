from __future__ import annotations

import hashlib
import json
from collections import defaultdict
from collections.abc import Mapping, Sequence
from datetime import datetime, timedelta
from typing import Any
from uuid import UUID

import structlog

from polar.config import settings
from polar.kit.utils import utc_now
from polar.models import VoidActivitySpan, VoidEvent
from polar.postgres import AsyncReadSession, AsyncSession
from polar.void.deploy.schemas import DeployConfiguration
from polar.void.organization.service import organization as organization_service

from .repository import ActivityEventRepository, ActivitySpanRepository
from .schemas import (
    ActivityReport,
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
from .typesafe import Classifier, TypeSafeClassifier, TypeSafeError

log = structlog.get_logger()

DEBOUNCE = timedelta(seconds=1)
RETRY_BACKOFF = timedelta(seconds=30)
SWEEP_BATCH = 50

_SPAN_METADATA = {
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


def event_metadata(payload: Mapping[str, Any]) -> dict[str, Any]:
    return json.loads(payload["metadata"])


def span_key_of(payload: Mapping[str, Any], group_by: str) -> str:
    value = event_metadata(payload).get(group_by)
    return value if isinstance(value, str) and value else payload["external_id"]


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
                "input_tokens": int(meta.get("input_tokens") or 0),
                "output_tokens": int(meta.get("output_tokens") or 0),
                "cost": meta.get("cost"),
                "fallback_from": meta.get("fallback_from"),
                "tools": [name for name in (meta.get("tools") or []) if name],
                "tool_errors": [
                    name for name in (meta.get("tool_errors") or []) if name
                ],
                "has_text": meta.get("has_text"),
            }
        )
    if len(rows) > SPAN_EVENT_CAP:
        ranked = sorted(
            range(1, len(rows) - 1),
            key=lambda i: (rows[i]["cost"] is None, -(rows[i]["cost"] or 0)),
        )[: SPAN_EVENT_CAP - 2]
        keep = {0, len(rows) - 1, *ranked}
        rows = [row for i, row in enumerate(rows) if i in keep]
    first = events[0]
    tools = list(dict.fromkeys(name for row in rows for name in row["tools"]))
    tool_errors = list(
        dict.fromkeys(name for row in rows for name in row["tool_errors"])
    )
    has_text = any(row["has_text"] is True for row in rows)
    has_tools = bool(tools)
    if has_text and has_tools:
        shape = "mixed"
    elif has_text:
        shape = "text"
    elif has_tools:
        shape = "tools"
    else:
        shape = "empty"
    meta = event_metadata(first.payload)
    return {
        "taxonomy": TAXONOMY,
        "span": {
            "call_id": span_key_of(first.payload, "call_id"),
            "external_identity_id": first.payload.get("external_identity_id"),
            "event_name": first.payload.get("name"),
            "event_count": len(events),
            "models": sorted({row["model"] for row in rows if row["model"]}),
            "finish_reasons": [
                row["finish_reason"] for row in rows if row["finish_reason"]
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
                key: value for key, value in meta.items() if key not in _SPAN_METADATA
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
        waste_cost = (
            cost
            if slug == "retry"
            else sum((span.cost or 0) * (span.waste or 0) for span in bucket)
        )
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

    async def report(
        self,
        session: AsyncReadSession,
        organization_id: UUID,
        *,
        identity: str | None = None,
        start: datetime | None = None,
        end: datetime | None = None,
    ) -> ActivityReport:
        version_id = await organization_service.active_version(session, organization_id)
        spans: Sequence[VoidActivitySpan] = []
        if version_id is not None:
            spans = await ActivitySpanRepository.from_session(session).list_spans(
                organization_id, version_id, identity=identity, start=start, end=end
            )
        return ActivityReport(
            window=ActivityWindow(start=start, end=end),
            totals=_totals(spans),
            by_activity=_shares(spans),
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
        events = await ActivityEventRepository.from_session(session).list_for_span(
            organization_id, span.event_name, span.group_by, span_key
        )
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
            first_event_at=span.first_event_at,
            last_event_at=span.last_event_at,
            classified_at=span.classified_at,
            event_ids=[event.external_id for event in events],
        )

    async def touch_events(
        self, session: AsyncSession, events: Sequence[VoidEvent]
    ) -> None:
        """Mark every span these events belong to as due for classification.
        The span row is the job: its ``due_at`` debounces, the sweep drains."""
        if not settings.VOID_ACTIVITY_ENABLED:
            return
        due_at = utc_now() + DEBOUNCE
        by_org: dict[UUID, list[VoidEvent]] = defaultdict(list)
        for event in events:
            by_org[event.organization_id].append(event)
        repository = ActivitySpanRepository.from_session(session)
        for organization_id, org_events in by_org.items():
            deployment = await organization_service.active_deployment(
                session, organization_id
            )
            if deployment is None:
                continue
            by_name = {
                definition.event: definition
                for definition in DeployConfiguration.of(deployment).activities
            }
            if not by_name:
                continue
            touched: dict[str, tuple[DeployActivity, VoidEvent]] = {}
            for event in org_events:
                name = event.payload.get("name")
                definition = by_name.get(name) if isinstance(name, str) else None
                if definition is None:
                    continue
                key = span_key_of(event.payload, definition.group_by)
                touched.setdefault(key, (definition, event))
            if not touched:
                continue
            existing = {
                span.span_key: span
                for span in await repository.get_spans(
                    organization_id, deployment.version_id, list(touched)
                )
            }
            for key, (definition, event) in touched.items():
                current = existing.get(key)
                if current is None:
                    current = self._pending_span(
                        organization_id, deployment.version_id, definition, key, event
                    )
                    session.add(current)
                current.due_at = due_at

    @staticmethod
    def _pending_span(
        organization_id: UUID,
        version_id: str,
        definition: DeployActivity,
        span_key: str,
        event: VoidEvent,
    ) -> VoidActivitySpan:
        meta = event_metadata(event.payload)
        cost = meta.get("cost")
        return VoidActivitySpan(
            version_id=version_id,
            span_key=span_key,
            event_name=definition.event,
            group_by=definition.group_by,
            organization_id=organization_id,
            external_identity_id=event.payload.get("external_identity_id"),
            external_root_id=event.payload.get("external_root_id"),
            first_event_at=event.timestamp,
            last_event_at=event.timestamp,
            state_hash="",
            activity=PENDING,
            cost=cost if isinstance(cost, int | float) else None,
            input_tokens=int(meta.get("input_tokens") or 0),
            output_tokens=int(meta.get("output_tokens") or 0),
            event_count=1,
        )

    async def classify_due(self, session: AsyncSession) -> int:
        """One sweep: label every span whose debounce has elapsed. A failed
        span is pushed back instead of failing the sweep; a span touched while
        being labeled keeps its newer ``due_at`` and comes round again."""
        repository = ActivitySpanRepository.from_session(session)
        due = await repository.list_due(utc_now(), limit=SWEEP_BATCH)
        for span in due:
            seen = span.due_at
            assert seen is not None
            try:
                await self.classify_span(session, span)
            except TypeSafeError as error:
                log.warning(
                    "void.activity.classify_failed",
                    span_key=span.span_key,
                    error=str(error),
                )
                span.due_at = utc_now() + RETRY_BACKOFF
                continue
            await repository.clear_due(span, seen)
        await session.flush()
        return len(due)

    async def classify_span(
        self, session: AsyncSession, span: VoidActivitySpan
    ) -> None:
        events = await ActivityEventRepository.from_session(session).list_for_span(
            span.organization_id, span.event_name, span.group_by, span.span_key
        )
        if not events:
            return
        state = summarize_events(events)
        digest = state_hash(state)
        if span.state_hash == digest and span.activity != PENDING:
            return
        first, last = events[0], events[-1]
        totals = state["span"]
        span.external_identity_id = first.payload.get("external_identity_id")
        span.external_root_id = first.payload.get("external_root_id")
        span.cost = totals["cost"]
        span.input_tokens = totals["input_tokens"]
        span.output_tokens = totals["output_tokens"]
        span.event_count = len(events)
        span.first_event_at = first.timestamp
        span.last_event_at = last.timestamp
        span.state_hash = digest
        try:
            result = await self.classifier.classify(state)
        except TypeSafeError:
            span.activity = PENDING
            await session.flush()
            raise
        if result.confidence >= CONFIDENCE_THRESHOLD:
            span.activity = result.activity
        else:
            span.activity = UNLABELED
        span.activity_confidence = result.confidence
        span.waste = result.waste
        span.model = result.model
        span.classified_at = utc_now()
        await session.flush()


activity = ActivityService()
