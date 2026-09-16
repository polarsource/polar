"""Reprice existing meter usage. No reducer processing or billing writes."""

import uuid
from collections.abc import Sequence
from datetime import UTC, datetime, time
from decimal import Decimal

from polar.auth.models import AuthSubject
from polar.models import Organization
from polar.postgres import AsyncSession
from polar.void.customer.service import customer as customer_service
from polar.void.identity.service import identity as identity_service
from polar.void.meter.balance import MeterEvent, State
from polar.void.meter.service import EPOCH
from polar.void.meter.service import meter as meter_service
from polar.void.meter.versions import meters_in_version
from polar.void.reducer.service import reducer as reducer_service
from polar.void.tinybird import TinybirdApi

from .preview_repository import PreviewRepository
from .schemas import Deploy, DeployCreate, MeterPricePreview, PricePreviewCustomer


def accrued_units(state: State) -> Decimal:
    """Closed-cycle overage plus the open period's current estimate."""
    return sum(
        (Decimal(str(cycle.overage)) for cycle in state.cycles.values()),
        Decimal(str(state.overage)),
    )


def unsupported_history(events: list[MeterEvent]) -> str | None:
    active: str | None = None
    for event in sorted(events, key=lambda event: (event.at, event.id)):
        # Buckets cannot split the usage either side of an unaligned term change.
        if event.at.minute % 5 or event.at.second or event.at.microsecond:
            return "subscription changes are not aligned to five-minute buckets"
        if event.name == "subscription.created":
            sid = str(event.data.get("id", event.id))
            if active is not None and active != sid:
                return "overlapping subscriptions need separate billing attribution"
            active = sid
        elif event.name in ("subscription.canceled", "subscription.revoked"):
            active = None
    return None


async def preview_prices(
    session: AsyncSession,
    tinybird: TinybirdApi,
    auth_subject: AuthSubject[Organization],
    request: DeployCreate,
    plan: Deploy,
    baseline_version_id: str | None,
    *,
    history: dict[tuple[uuid.UUID, str], list[MeterEvent]] | None = None,
) -> None:
    """Reprice the baseline version's usage at the proposed unit amounts."""
    organization_id = auth_subject.subject.id
    window = request.preview
    if window is None:
        return
    start = datetime.combine(window.start, time(), UTC)
    end = datetime.combine(window.end, time(), UTC)
    latest = meters_in_version(
        await meter_service.list(session, organization_id), baseline_version_id
    )
    reducers = {r.slug: r for r in await reducer_service.list(session, organization_id)}
    wanted = {m.slug: m for m in request.meters}
    customers = None

    for entry in plan.entries:
        if entry.kind != "meter" or (
            history is None and entry.action not in ("create", "replace")
        ):
            continue
        current = latest.get(entry.key)
        if current is None:
            continue
        proposed = wanted[entry.key]
        if (
            history is None
            and current.unit_amount == proposed.unit_amount
            and current.currency == proposed.currency
        ):
            continue
        preview = MeterPricePreview(
            window=window,
            currency=current.currency,
            current_unit_amount=current.unit_amount,
            proposed_unit_amount=proposed.unit_amount,
            customers=[],
            billable_units=Decimal(0),
            current_amount=Decimal(0),
            proposed_amount=Decimal(0),
            difference=Decimal(0),
            unavailable=None,
            excluded_customers=[],
        )
        entry.price_preview = preview
        usage = reducers.get(proposed.reducer)
        credits = reducers.get(proposed.credit_reducer or f"{proposed.reducer}-credits")
        if current.currency != proposed.currency:
            preview.unavailable = (
                "Currency changes cannot be compared as a price-only change."
            )
            continue
        if (
            usage is None
            or credits is None
            or usage.id != current.usage_reducer_id
            or credits.id != current.credit_reducer_id
        ):
            preview.unavailable = "Usage and credit reducers must stay unchanged."
            continue
        if usage.aggregation.func not in ("sum", "count"):
            preview.unavailable = "This preview supports sum and count usage reducers."
            continue
        if usage.id == credits.id:
            preview.unavailable = (
                "Usage and credits need separate reducers for this preview."
            )
            continue
        if customers is None:
            customers = await customer_service.list(session, auth_subject)

        for customer in customers:
            source = (
                history.get((current.id, customer.external_id), [])
                if history is not None
                else await meter_service._events(
                    tinybird, current, [customer.external_id], EPOCH, end
                )
            )
            events: list[MeterEvent] = [
                event
                for event in source
                if event.name
                in (
                    "subscription.created",
                    "subscription.updated",
                    "subscription.canceled",
                    "subscription.revoked",
                )
            ]
            # A comparison uses the source version's subscription holders;
            # credits elsewhere in the organization must not add customers.
            if history is not None and not events:
                continue
            reason = unsupported_history(events)
            if reason:
                preview.excluded_customers.append(f"{customer.external_id}: {reason}")
                continue
            # Both endpoints use these same bucket reads, even if ingestion
            # catches up while the preview is running. Sum/count are additive.
            buckets: dict[uuid.UUID, list[tuple[datetime, float]]] = {}
            for reducer, actor in ((usage, False), (credits, True)):
                buckets[reducer.id] = await PreviewRepository.from_session(
                    session
                ).buckets(reducer, customer.external_id, end, actor=actor)
            identity = await identity_service.get(
                session, organization_id, customer.external_id
            )

            async def read_values(
                reducer_id: uuid.UUID,
                edges: Sequence[datetime],
                lower: datetime,
                upper: datetime,
                snapshot: dict[uuid.UUID, list[tuple[datetime, float]]] = buckets,
            ) -> Sequence[tuple[datetime, float]]:
                return [
                    (timestamp, value)
                    for timestamp, value in snapshot[reducer_id]
                    if lower <= timestamp < upper
                ]

            # Reuse the production balance fold, including credits, subtree usage,
            # rollover and cycle boundaries. Settlements are recomputed in memory
            # from buckets, so a stored checkpoint cannot hide earlier periods.
            before, _, _ = await meter_service._fold(
                session,
                tinybird,
                current,
                identity,
                start,
                events=[event for event in events if event.at <= start],
                values=read_values,
            )
            after, _, has_credits = await meter_service._fold(
                session,
                tinybird,
                current,
                identity,
                end,
                events=events,
                values=read_values,
            )
            if not events and not has_credits:
                if after.usage:
                    preview.excluded_customers.append(
                        f"{customer.external_id}: no root subscription or credits"
                    )
                continue
            units = accrued_units(after) - accrued_units(before)
            current_amount = units * Decimal(current.unit_amount)
            proposed_amount = units * proposed.unit_amount
            preview.customers.append(
                PricePreviewCustomer(
                    external_id=customer.external_id,
                    name=customer.name,
                    billable_units=units,
                    current_amount=current_amount,
                    proposed_amount=proposed_amount,
                    difference=proposed_amount - current_amount,
                )
            )
            preview.billable_units += units
            preview.current_amount += current_amount
            preview.proposed_amount += proposed_amount
        preview.difference = preview.proposed_amount - preview.current_amount
        preview.customers.sort(key=lambda row: (-abs(row.difference), row.external_id))
