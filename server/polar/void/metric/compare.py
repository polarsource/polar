"""Read-only POC: one variant's subscription history, another's meter prices."""

import uuid
from datetime import UTC, date, datetime, time
from typing import Self

from pydantic import BaseModel, Field, model_validator

from polar.auth.models import AuthSubject
from polar.exceptions import ResourceNotFound
from polar.kit.utils import utc_now
from polar.models import Organization
from polar.postgres import AsyncSession
from polar.void.customer.service import customer as customer_service
from polar.void.deploy.preview import preview_prices
from polar.void.deploy.schemas import (
    Deploy,
    DeployCreate,
    DeployEntry,
    DeployMeter,
    PricePreviewWindow,
)
from polar.void.deploy.service import _latest_meters
from polar.void.meter.balance import MeterEvent
from polar.void.meter.service import EPOCH
from polar.void.meter.service import meter as meter_service
from polar.void.reducer.service import reducer as reducer_service
from polar.void.tinybird import TinybirdApi

from .schemas import Metrics, MetricsQuery, TimeInterval
from .service import metric as metric_service


class CompareQuery(BaseModel):
    baseline: str = Field(
        description="Subscription history variant; empty means unversioned."
    )
    candidate: str = Field(description="Pricing variant; empty means unversioned.")
    start: date
    end: date

    @model_validator(mode="after")
    def valid_window(self) -> Self:
        if self.start >= self.end:
            raise ValueError("start must be before end")
        if self.end > datetime.now(UTC).date():
            raise ValueError("end must be today or earlier")
        return self


class ComparisonMetric(BaseModel):
    slug: str
    func: str
    metrics: Metrics


class MetricComparison(BaseModel):
    baseline: str | None
    candidate: str | None
    window: PricePreviewWindow
    customer_count: int
    shared_metrics: list[ComparisonMetric]
    meters: list[DeployEntry]


async def compare(
    session: AsyncSession,
    tinybird: TinybirdApi,
    auth_subject: AuthSubject[Organization],
    query: CompareQuery,
) -> MetricComparison:
    organization_id = auth_subject.subject.id
    baseline_id, candidate_id = query.baseline or None, query.candidate or None
    meters = await meter_service.list(session, organization_id)
    baseline = _latest_meters(meters, baseline_id)
    candidate = _latest_meters(meters, candidate_id)
    if not baseline or not candidate:
        raise ResourceNotFound("Both variants must have meters in this organization")
    reducers = await reducer_service.list(session, organization_id)
    by_id = {r.id: r for r in reducers}
    if any(
        meter.usage_reducer_id not in by_id or meter.credit_reducer_id not in by_id
        for meter in candidate.values()
    ):
        raise ResourceNotFound("A candidate meter references a deleted reducer")
    customers = await customer_service.list(session, auth_subject)
    end = datetime.combine(query.end, time(), UTC)
    history: dict[tuple[uuid.UUID, str], list[MeterEvent]] = {}
    roots: set[str] = set()
    for meter in meters:
        if meter.variant_id != baseline_id or meter.branch_id is not None:
            continue
        for customer in customers:
            events = [
                event
                for event in await meter_service._events(
                    tinybird, meter, [customer.external_id], EPOCH, end
                )
                if event.name
                in (
                    "subscription.created",
                    "subscription.updated",
                    "subscription.canceled",
                    "subscription.revoked",
                )
                and event.at < end
            ]
            history[meter.id, customer.external_id] = events
            if events:
                roots.add(customer.external_id)

    # No alternate metric calculations: including derived reducers, query the
    # existing service over the same cohort. Recorded events remain recorded.
    shared = []
    for reducer in reducers:
        if reducer.aggregation.type != "scalar":
            continue
        shared.append(
            ComparisonMetric(
                slug=reducer.slug,
                func=reducer.aggregation.func,
                metrics=await metric_service.get(
                    session,
                    organization_id,
                    MetricsQuery(
                        reducer_id=reducer.id,
                        start=datetime.combine(query.start, time(), UTC),
                        end=end,
                        interval=TimeInterval.day,
                    ),
                    root_ids=sorted(roots),
                ),
            )
        )

    # Reuse plan's production meter fold. This in-memory request is only an
    # adapter for the price preview; it never goes through deployment.
    request = DeployCreate(
        checksum="comparison",
        dry_run=True,
        preview=PricePreviewWindow(start=query.start, end=query.end),
        meters=[
            DeployMeter(
                slug=meter.slug,
                reducer=by_id[meter.usage_reducer_id].slug,
                credit_reducer=by_id[meter.credit_reducer_id].slug,
                unit_amount=meter.unit_amount,
                currency=meter.currency,
            )
            for meter in candidate.values()
        ],
    )
    plan = Deploy(
        variant_id=candidate_id,
        id=None,
        checksum="comparison",
        applied=False,
        created_at=utc_now(),
        entries=[
            DeployEntry(
                kind="meter",
                key=slug,
                action="unchanged",
                id=None,
                reason=None,
                price_preview=None,
            )
            for slug in sorted(baseline.keys() | candidate.keys())
        ],
    )
    # Only matched meters can inherit subscription history by slug. Explicitly
    # report additions/removals instead of presenting them as zero revenue.
    matched = [e for e in plan.entries if e.key in baseline and e.key in candidate]
    preview_plan = plan.model_copy(update={"entries": matched})
    await preview_prices(
        session,
        tinybird,
        auth_subject,
        request,
        preview_plan,
        baseline_id,
        history=history,
    )
    for entry in plan.entries:
        if entry.key not in baseline:
            entry.reason = "No matching meter in the baseline subscription history."
        elif entry.key not in candidate:
            entry.reason = "Meter is absent from the candidate configuration."
    return MetricComparison(
        baseline=baseline_id,
        candidate=candidate_id,
        window=PricePreviewWindow(start=query.start, end=query.end),
        customer_count=len(roots),
        shared_metrics=shared,
        meters=plan.entries,
    )
