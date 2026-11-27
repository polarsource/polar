import dataclasses
import math
import uuid
from collections.abc import Mapping, Sequence
from datetime import datetime
from decimal import Decimal

import structlog
from sqlalchemy import and_, false, or_

from polar.billing_interval.repository import BillingIntervalRepository
from polar.billing_interval.service import billing_interval as billing_interval_service
from polar.billing_interval.service import select_settlement_windows
from polar.event.repository import EventRepository
from polar.meter.service import meter as meter_service
from polar.models import BillingEntry, Meter, Subscription
from polar.models.reducer import ReducerKind
from polar.postgres import AsyncSession
from polar.reducer.bucket_repository import ReducerBucketRepository
from polar.reducer.repository import ReducerRepository
from polar.reducer.service import REDUCER_BUCKET_SIZE

log = structlog.get_logger(__name__)

EXPLAIN_STATEMENT_TIMEOUT = "5s"
"""Below the driver's command timeout, which breaks the order's transaction."""


@dataclasses.dataclass(frozen=True)
class Quantities:
    usage: Decimal
    credits: Decimal
    net: Decimal

    def matches(self, other: "Quantities") -> bool:
        return (
            math.isclose(self.usage, other.usage)
            and math.isclose(self.credits, other.credits)
            and math.isclose(self.net, other.net)
        )

    def to_dict(self) -> dict[str, str]:
        return {
            "usage": str(self.usage),
            "credits": str(self.credits),
            "net": str(self.net),
        }


@dataclasses.dataclass(frozen=True)
class Adjustment:
    """What legacy bills on top of the reducer for one cause."""

    usage: Decimal = Decimal(0)
    credits: Decimal = Decimal(0)
    net: Decimal = Decimal(0)


def explain(reducer: Quantities, adjustments: Mapping[str, Adjustment]) -> Quantities:
    """The quantities legacy bills, from the reducer's and the adjustments."""
    usage = reducer.usage + sum(
        (adjustment.usage for adjustment in adjustments.values()), Decimal(0)
    )
    credits = reducer.credits + sum(
        (adjustment.credits for adjustment in adjustments.values()), Decimal(0)
    )
    net = max(Decimal(0), usage - credits) + sum(
        (adjustment.net for adjustment in adjustments.values()), Decimal(0)
    )
    return Quantities(usage=usage, credits=credits, net=net)


@dataclasses.dataclass(frozen=True)
class Comparison:
    legacy: Quantities
    reducer: Quantities
    adjustments: Mapping[str, Adjustment]

    @property
    def explained(self) -> Quantities:
        return explain(self.reducer, self.adjustments)

    @property
    def raw_match(self) -> bool:
        return self.reducer.matches(self.legacy)

    @property
    def match(self) -> bool:
        return self.explained.matches(self.legacy)

    def to_dict(self) -> dict[str, object]:
        return {
            "legacy": self.legacy.to_dict(),
            "reducer": self.reducer.to_dict(),
            "adjustments": {
                cause: {
                    field: str(units)
                    for field, units in dataclasses.asdict(adjustment).items()
                    if units
                }
                for cause, adjustment in self.adjustments.items()
            },
            "explained": self.explained.to_dict(),
        }


async def compare(
    session: AsyncSession,
    subscription: Subscription,
    meter: Meter,
    order_id: uuid.UUID,
    order_item_ids: Sequence[uuid.UUID],
    *,
    legacy: Quantities,
    reducer: Quantities,
    cutoff: datetime,
) -> Comparison:
    """Compares the reducer's quantities on the meter with legacy's, explaining
    their differences when they don't match."""
    if reducer.matches(legacy):
        return Comparison(legacy=legacy, reducer=reducer, adjustments={})
    try:
        async with (
            BillingIntervalRepository.from_session(session).local_statement_timeout(
                EXPLAIN_STATEMENT_TIMEOUT
            ),
            session.begin_nested(),
        ):
            adjustments = {
                **await _get_usage_adjustments(
                    session,
                    subscription,
                    meter,
                    order_id,
                    order_item_ids,
                    cutoff=cutoff,
                ),
                **await _get_credit_adjustments(
                    session, subscription, meter, cutoff=cutoff
                ),
            }
    except Exception:
        log.exception(
            "Failed to explain the reducer comparison",
            subscription_id=subscription.id,
            meter_id=meter.id,
        )
        adjustments = {}
    adjustments["unpooled_net"] = Adjustment(
        net=legacy.net - max(Decimal(0), legacy.usage - legacy.credits)
    )
    return Comparison(
        legacy=legacy,
        reducer=reducer,
        adjustments={
            cause: adjustment
            for cause, adjustment in adjustments.items()
            if adjustment != Adjustment()
        },
    )


async def _get_usage_adjustments(
    session: AsyncSession,
    subscription: Subscription,
    meter: Meter,
    order_id: uuid.UUID,
    order_item_ids: Sequence[uuid.UUID],
    *,
    cutoff: datetime,
) -> dict[str, Adjustment]:
    if not meter.aggregation.is_summable():
        return {}
    windows = select_settlement_windows(
        await billing_interval_service.get_usage_windows(
            session, subscription.customer, meter.id, cutoff=cutoff
        ),
        billing_subscription_id=subscription.id,
    )
    in_windows = or_(
        false(),
        *(
            and_(
                BillingEntry.start_timestamp >= window.start,
                BillingEntry.start_timestamp < window.end,
            )
            for window in windows
        ),
    )
    repository = EventRepository.from_session(session)
    deferred_usage = await meter_service.get_quantity(
        session,
        meter,
        repository.get_by_pending_meter_entries_statement(
            subscription.id, meter.id
        ).where(in_windows),
    )
    carried_over_usage = await _get_carried_over_usage(
        session, meter, order_id, order_item_ids
    )
    return {
        "deferred_usage": Adjustment(usage=-Decimal(str(deferred_usage))),
        "carried_over_usage": Adjustment(usage=Decimal(str(carried_over_usage))),
    }


async def _get_carried_over_usage(
    session: AsyncSession,
    meter: Meter,
    order_id: uuid.UUID,
    order_item_ids: Sequence[uuid.UUID],
) -> float:
    """Usage legacy bills in this order that the reducer billed in another one."""
    reducer = await ReducerRepository.from_session(session).get_by_meter_and_kind(
        meter.id, ReducerKind.usage
    )
    if reducer is None:
        return 0.0
    repository = EventRepository.from_session(session)
    return await meter_service.get_quantity(
        session,
        meter,
        repository.get_by_order_item_entries_statement(order_item_ids).where(
            ReducerBucketRepository.from_session(
                session
            ).get_event_billed_by_other_order_clause(
                reducer,
                order_id,
                await repository.get_order_item_entries_identities(order_item_ids),
                bucket_size=REDUCER_BUCKET_SIZE,
            )
        ),
    )


async def _get_credit_adjustments(
    session: AsyncSession,
    subscription: Subscription,
    meter: Meter,
    *,
    cutoff: datetime,
) -> dict[str, Adjustment]:
    repository = EventRepository.from_session(session)
    reset = await repository.get_latest_meter_reset(
        subscription.customer, meter.id, cutoff=cutoff
    )
    deferred = await repository.get_pending_meter_credits(
        subscription.id,
        meter.id,
        since=reset.timestamp if reset is not None else None,
        until=cutoff,
    )
    deferred_credits = sum(
        (Decimal(event.user_metadata["units"]) for event in deferred), Decimal(0)
    )
    return {"deferred_credits": Adjustment(credits=-deferred_credits)}
