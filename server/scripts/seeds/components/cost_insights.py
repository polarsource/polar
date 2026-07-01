"""Cost insights seed component (LLM / infra cost spans).

Reuses the span builder from `seeds_load.py` for now; that builder will move
into this package as part of the cutover (see MIGRATION.md).
"""

from __future__ import annotations

from sqlalchemy import select

from polar.event.repository import EventRepository
from polar.models.event import Event as EventModel

from scripts.seeds.base import SeedContext, Variant
from scripts.seeds.events import (
    _build_user_cost_span_events,
    _flush_tinybird_events,
    _stamp_event_type_ids,
)


class CostInsightsComponent:
    key = "cost_insights"
    label = "Cost insights"
    default_on = False
    requires = ["customers"]
    variants: list[Variant] = []

    async def build(self, ctx: SeedContext, variant: str | None) -> str:
        customers = ctx.created.get("customers", [])
        if not customers:
            return "cost insights: no customers"

        event_repository = EventRepository.from_session(ctx.session)
        pending_events: list[EventModel] = []
        pending_ancestors: dict = {}
        total = 0

        for customer in customers:
            spans = _build_user_cost_span_events(
                organization_id=ctx.organization.id,
                customer_id=customer.id,
            )
            if not spans:
                continue
            await _stamp_event_type_ids(ctx.session, spans)
            event_ids, _ = await event_repository.insert_batch(spans)
            total += len(event_ids)
            if event_ids:
                inserted = await event_repository.get_all(
                    select(EventModel).where(EventModel.id.in_(event_ids))
                )
                ancestors = await event_repository.get_ancestors_batch(event_ids)
                pending_events.extend(inserted)
                pending_ancestors.update(ancestors)

        if not ctx.skip_tinybird:
            await _flush_tinybird_events(pending_events, pending_ancestors)

        return f"{total} cost events"


component = CostInsightsComponent()
