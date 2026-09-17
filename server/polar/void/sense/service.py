from __future__ import annotations

from collections.abc import Sequence
from datetime import timedelta
from typing import Any
from uuid import UUID

from temporalio.client import Client

from polar.exceptions import ResourceNotFound
from polar.kit.utils import utc_now
from polar.models import VoidActivitySpan, VoidSense, VoidSenseObservation
from polar.postgres import AsyncReadSession, AsyncSession
from polar.void.activity.repository import ActivitySpanRepository
from polar.void.activity.service import state_hash
from polar.void.activity.taxonomy import ACTIVITY_CRITERIA, PENDING, UNLABELED
from polar.void.activity.typesafe import Judge, TypeSafeClassifier, TypeSafeError
from polar.void.activity.workflows import ClassifySenseInput, ClassifySenseWorkflow
from polar.void.identity.service import identity as identity_service
from polar.void.temporal import TASK_QUEUE

from .repository import SenseObservationRepository, SenseRepository
from .schemas import (
    CustomerSenseState,
    DeploySense,
    SenseCreate,
    SenseOver,
    SenseOverRun,
    SenseOverWindow,
)

WINDOW_SECONDS = {"minute": 60, "hour": 3600, "day": 86400}
SPAN_CAP = 40
WINDOW_RUN_KEY = ""


def over_of(sense: VoidSense) -> SenseOver:
    if sense.over_type == "run":
        return SenseOverRun(type="run")
    assert sense.window_amount is not None
    assert sense.window_unit is not None
    return SenseOverWindow(
        type="window",
        amount=sense.window_amount,
        unit=sense.window_unit,  # type: ignore[arg-type]
    )


def _same_sense(wanted: DeploySense, current: VoidSense) -> bool:
    over = over_of(current)
    return (
        current.activity_slug == wanted.activity
        and current.when == wanted.when
        and over.model_dump(mode="json") == wanted.over.model_dump(mode="json")
    )


def _mix(spans: Sequence[VoidActivitySpan]) -> dict[str, Any]:
    labeled = [span for span in spans if span.activity in ACTIVITY_CRITERIA]
    labeled_cost = sum(span.cost or 0 for span in labeled)
    by_activity: list[dict[str, Any]] = []
    for slug in ACTIVITY_CRITERIA:
        bucket = [span for span in labeled if span.activity == slug]
        if not bucket:
            continue
        cost = sum(span.cost or 0 for span in bucket)
        waste_cost = (
            cost
            if slug == "retry"
            else sum((span.cost or 0) * (span.waste or 0) for span in bucket)
        )
        by_activity.append(
            {
                "slug": slug,
                "cost": cost,
                "share": (cost / labeled_cost) if labeled_cost else 0,
                "spans": len(bucket),
                "waste_cost": waste_cost,
            }
        )
    cost = sum(span.cost or 0 for span in spans)
    return {
        "cost": cost,
        "spans": len(spans),
        "labeled_cost": labeled_cost,
        "by_activity": by_activity,
    }


def _fold_state(
    sense: VoidSense,
    identity: str,
    root: str | None,
    run_key: str,
    spans: Sequence[VoidActivitySpan],
) -> dict[str, Any]:
    rows = [
        {
            "activity": span.activity,
            "waste": span.waste,
            "cost": span.cost,
            "input_tokens": span.input_tokens,
            "output_tokens": span.output_tokens,
            "event_count": span.event_count,
            "run_key": span.run_key,
            "last_event_at": span.last_event_at.isoformat(),
        }
        for span in spans[:SPAN_CAP]
    ]
    return {
        "when": sense.when,
        "over": over_of(sense).model_dump(mode="json"),
        "identity": {"external_id": identity, "root_id": root},
        "run_key": run_key or None,
        "mix": _mix(spans),
        "spans": rows,
    }


class SenseService:
    def __init__(self, judge: Judge | None = None) -> None:
        self.classifier = judge or TypeSafeClassifier()

    async def list(
        self, session: AsyncReadSession, organization_id: UUID
    ) -> Sequence[VoidSense]:
        return await SenseRepository.from_session(session).list(organization_id)

    async def list_for_version(
        self, session: AsyncReadSession, organization_id: UUID, version_id: str
    ) -> Sequence[VoidSense]:
        return await SenseRepository.from_session(session).list_for_version(
            organization_id, version_id
        )

    async def create(
        self,
        session: AsyncSession,
        organization_id: UUID,
        create_schema: SenseCreate,
    ) -> VoidSense:
        over = create_schema.over
        return await SenseRepository.from_session(session).create(
            VoidSense(
                slug=create_schema.slug,
                version_id=create_schema.version_id,
                activity_id=create_schema.activity_id,
                activity_slug=create_schema.activity_slug,
                when=create_schema.when,
                over_type=over.type,
                window_amount=over.amount if over.type == "window" else None,
                window_unit=over.unit if over.type == "window" else None,
                organization_id=organization_id,
            ),
            flush=True,
        )

    def same(self, wanted: DeploySense, current: VoidSense) -> bool:
        return _same_sense(wanted, current)

    async def observations_for(
        self,
        session: AsyncReadSession,
        organization_id: UUID,
        version_id: str,
        identities: Sequence[str],
    ) -> list[CustomerSenseState]:
        senses = {
            sense.id: sense
            for sense in await self.list_for_version(
                session, organization_id, version_id
            )
        }
        if not senses:
            return []
        rows = await SenseObservationRepository.from_session(session).list_for_root(
            organization_id, version_id, identities
        )
        latest: dict[tuple[UUID, str], VoidSenseObservation] = {}
        for row in rows:
            sense = senses.get(row.sense_id)
            if sense is None:
                continue
            key = (row.sense_id, row.external_identity_id)
            if sense.over_type == "run":
                current = latest.get(key)
                if current is not None and current.evaluated_at >= row.evaluated_at:
                    continue
            latest[key] = row
        states: list[CustomerSenseState] = []
        for row in latest.values():
            sense = senses[row.sense_id]
            states.append(
                CustomerSenseState(
                    slug=sense.slug,
                    activity=sense.activity_slug,
                    when=sense.when,
                    over=over_of(sense),
                    identity_id=row.external_identity_id,
                    run_key=row.run_key or None,
                    noul=row.noul,
                    span_count=row.span_count,
                    cost=row.cost,
                    evaluated_at=row.evaluated_at,
                )
            )
        states.sort(key=lambda item: (item.slug, item.identity_id))
        return states

    async def touch_span(
        self,
        session: AsyncSession,
        temporal: Client,
        span: VoidActivitySpan,
    ) -> None:
        if span.activity in {PENDING, UNLABELED} or not span.external_identity_id:
            return
        senses = await SenseRepository.from_session(session).list_for_activity(
            span.organization_id, span.version_id, span.activity_id
        )
        if not senses:
            return
        identity = await identity_service.get(
            session, span.organization_id, span.external_identity_id
        )
        try:
            chain = await identity_service.chain(session, identity)
        except Exception:
            chain = [identity]
        for sense in senses:
            if sense.over_type == "run":
                if not span.run_key:
                    continue
                await self._start(
                    temporal,
                    span.organization_id,
                    sense.id,
                    span.external_identity_id,
                    span.run_key,
                )
                continue
            for node in chain:
                await self._start(
                    temporal,
                    span.organization_id,
                    sense.id,
                    node.external_id,
                    WINDOW_RUN_KEY,
                )

    async def _start(
        self,
        temporal: Client,
        organization_id: UUID,
        sense_id: UUID,
        identity_id: str,
        run_key: str,
    ) -> None:
        token = run_key or "window"
        await temporal.start_workflow(
            ClassifySenseWorkflow.run,
            ClassifySenseInput(
                str(organization_id), str(sense_id), identity_id, run_key
            ),
            id=f"polar-void-sense-{organization_id}-{sense_id}-{identity_id}-{token}",
            task_queue=TASK_QUEUE,
            start_signal="touch",
        )

    async def classify_sense(
        self,
        session: AsyncSession,
        organization_id: UUID,
        sense_id: UUID,
        identity_id: str,
        run_key: str,
    ) -> VoidSenseObservation | None:
        sense = await SenseRepository.from_session(session).get(
            organization_id, sense_id
        )
        if sense is None:
            return None
        try:
            identity = await identity_service.get(session, organization_id, identity_id)
        except ResourceNotFound:
            return None
        root = await identity_service.root_of(session, identity)
        subtree = await identity_service.subtree(session, identity)
        ids = [node.external_id for node in subtree]
        start = None
        grain_run = run_key if sense.over_type == "run" else None
        if sense.over_type == "window":
            assert sense.window_amount is not None
            assert sense.window_unit is not None
            start = utc_now() - timedelta(
                seconds=sense.window_amount * WINDOW_SECONDS[sense.window_unit]
            )
        spans = [
            span
            for span in await ActivitySpanRepository.from_session(session).list_spans(
                organization_id,
                sense.version_id,
                identities=ids,
                run_key=grain_run,
                start=start,
                activity_id=sense.activity_id,
            )
            if span.activity in ACTIVITY_CRITERIA
        ]
        if not spans:
            return None
        state = _fold_state(sense, identity_id, root.external_id, run_key, spans)
        digest = state_hash(state)
        repository = SenseObservationRepository.from_session(session)
        current = await repository.get_observation(
            organization_id, sense.version_id, sense.id, identity_id, run_key
        )
        if current is not None and current.state_hash == digest:
            return current
        try:
            result = await self.classifier.judge(state, sense.when)
        except TypeSafeError:
            raise
        mix = state["mix"]
        if current is None:
            current = VoidSenseObservation(
                sense_id=sense.id,
                version_id=sense.version_id,
                organization_id=organization_id,
                external_identity_id=identity_id,
                run_key=run_key,
                noul=result.noul,
                state_hash=digest,
                evaluated_at=utc_now(),
            )
            session.add(current)
        current.external_root_id = root.external_id
        current.noul = result.noul
        current.state_hash = digest
        current.model = result.model
        current.span_count = mix["spans"]
        current.cost = mix["cost"] or None
        current.mix = mix
        current.evaluated_at = utc_now()
        await session.flush()
        return current


sense = SenseService()
