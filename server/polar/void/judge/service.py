"""One Jev question about one identity's recent meter events, cached by state.

The SDK owns the question and the thresholds. Polar reads the window, asks Jev
once per distinct state, and hands back the noul with the evidence it judged.
"""

from __future__ import annotations

from collections import deque
from collections.abc import Mapping, Sequence
from datetime import datetime, timedelta
from typing import Any
from uuid import UUID

from polar.exceptions import ResourceNotFound
from polar.kit.utils import utc_now
from polar.models import VoidEvent, VoidJudgment
from polar.postgres import AsyncSession
from polar.void.activity.service import event_metadata, state_hash
from polar.void.event.repository import EventRepository
from polar.void.identity.service import identity as identity_service
from polar.void.meter.service import meter as meter_service
from polar.void.meter.versions import meters_in_version
from polar.void.reducer.filter import EventMatcher
from polar.void.reducer.repository import ReducerRepository
from polar.void.typesafe import Judge, TypeSafe, TypeSafeError

from .repository import JudgmentRepository
from .schemas import Evidence, JudgeRequest, Judgment

MIN_INTERVAL = timedelta(seconds=60)
EVENT_FETCH_CAP = 1000
SAMPLE_CAP = 40
VALUE_CAP = 8
KEY_CAP = 16
STRING_CAP = 120

Matched = tuple[VoidEvent, Mapping[str, Any]]


def _number(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    try:
        return float(value)
    except TypeError, ValueError:
        return None


def _compact(metadata: Mapping[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for key, value in metadata.items():
        if isinstance(value, str):
            out[key] = value[:STRING_CAP]
        elif isinstance(value, bool | int | float):
            out[key] = value
        elif isinstance(value, list):
            strings = [item[:STRING_CAP] for item in value if isinstance(item, str)]
            if strings:
                out[key] = strings[:10]
    return out


def summarize(matched: Sequence[Matched]) -> Evidence:
    """Everything Jev is told about the window, in event order."""
    ordered = sorted(matched, key=lambda pair: (pair[0].timestamp, pair[0].external_id))
    totals: dict[str, float] = {}
    values: dict[str, list[str]] = {}
    identities: set[str] = set()
    first: dict[str, Any] | None = None
    recent: deque[dict[str, Any]] = deque(maxlen=SAMPLE_CAP - 1)
    previous: datetime | None = None
    for event, raw in ordered:
        metadata = _compact(raw)
        identity = event.payload.get("external_identity_id")
        if isinstance(identity, str):
            identities.add(identity)
        for key, value in metadata.items():
            number = _number(value)
            if number is not None:
                totals[key] = totals.get(key, 0.0) + number
                continue
            seen = values.setdefault(key, [])
            for item in value if isinstance(value, list) else [value]:
                if item not in seen and len(seen) < VALUE_CAP:
                    seen.append(item)
        row = {
            "id": event.external_id,
            "at": event.timestamp.isoformat(),
            "identity": identity,
            "gap_ms": (
                int((event.timestamp - previous).total_seconds() * 1000)
                if previous is not None
                else None
            ),
            **metadata,
        }
        if first is None:
            first = row
        else:
            recent.append(row)
        previous = event.timestamp
    return Evidence(
        events=len(ordered),
        identities=len(identities),
        first_at=ordered[0][0].timestamp if ordered else None,
        last_at=ordered[-1][0].timestamp if ordered else None,
        totals=dict(sorted(totals.items())[:KEY_CAP]),
        values=dict(sorted(values.items())[:KEY_CAP]),
        sample=[first, *recent] if first is not None else [],
    )


class JudgeService:
    def __init__(self, judge: Judge | None = None) -> None:
        self.jev = judge or TypeSafe()

    async def judge(
        self,
        session: AsyncSession,
        organization_id: UUID,
        identity_id: str,
        request: JudgeRequest,
        version_id: str | None,
    ) -> Judgment:
        if version_id is None:
            raise ResourceNotFound("No active deployment to judge against.")
        meter = meters_in_version(
            await meter_service.list(session, organization_id), version_id
        ).get(request.meter)
        if meter is None:
            raise ResourceNotFound(
                f"No meter {request.meter!r} in version {version_id[:12]}."
            )
        reducer = await ReducerRepository.from_session(session).get_scoped(
            organization_id, meter.usage_reducer_id
        )
        if reducer is None:
            raise ResourceNotFound("The meter's usage reducer is gone.")
        identity = await identity_service.get(session, organization_id, identity_id)
        root = await identity_service.root_of(session, identity)
        subtree = await identity_service.subtree(session, identity)
        now = utc_now()
        start = now - timedelta(seconds=request.over.seconds)
        matcher = EventMatcher(reducer.filter)
        matched: list[Matched] = []
        for event in await EventRepository.from_session(session).list_window(
            organization_id,
            [node.external_id for node in subtree],
            start,
            now,
            matcher.event_names,
            EVENT_FETCH_CAP,
        ):
            metadata = event_metadata(event.payload)
            if matcher.matches(str(event.payload.get("name")), metadata):
                matched.append((event, metadata))
        evidence = summarize(matched)
        dumped = evidence.model_dump(mode="json")
        digest = state_hash(
            {
                "evidence": dumped,
                "events": sorted(event.external_id for event, _ in matched),
            }
        )
        question = state_hash(
            {"when": request.when, "over": request.over.model_dump(mode="json")}
        )
        repository = JudgmentRepository.from_session(session)
        current = await repository.get(
            organization_id, version_id, identity_id, request.meter, question
        )

        def reply(row: VoidJudgment) -> Judgment:
            return Judgment(
                identity_id=identity_id,
                root_id=root.external_id,
                meter=request.meter,
                when=request.when,
                over=request.over,
                noul=row.noul,
                model=row.model,
                judged_at=row.judged_at,
                stale=row.state_hash != digest,
                evidence=(
                    evidence
                    if row.state_hash == digest
                    else Evidence.model_validate(row.evidence)
                ),
            )

        if current is not None:
            if current.state_hash == digest and current.noul is not None:
                return reply(current)
            if now - current.asked_at < MIN_INTERVAL:
                return reply(current)
        else:
            current = VoidJudgment(
                organization_id=organization_id,
                version_id=version_id,
                external_identity_id=identity_id,
                meter_slug=request.meter,
                question_hash=question,
                state_hash=digest,
                evidence=dumped,
                asked_at=now,
            )
            session.add(current)

        current.asked_at = now
        try:
            if matched:
                result = await self.jev.judge(
                    {
                        "when": request.when,
                        "window": {
                            **request.over.model_dump(mode="json"),
                            "start": start.isoformat(),
                            "end": now.isoformat(),
                        },
                        "identity": {
                            "external_id": identity_id,
                            "root_id": root.external_id,
                            "subtree": len(subtree),
                        },
                        "meter": {
                            "slug": meter.slug,
                            "unit_amount": str(meter.unit_amount),
                            "currency": meter.currency,
                        },
                        "evidence": dumped,
                    },
                    request.when,
                )
                current.noul, current.model = result.noul, result.model
            else:
                current.noul, current.model = 0.0, None
            current.judged_at = now
            current.state_hash = digest
            current.evidence = dumped
        except TypeSafeError:
            pass
        await session.flush()
        return reply(current)


judge = JudgeService()
