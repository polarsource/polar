import calendar
import math
from datetime import datetime, timedelta
from typing import Any, Literal

from pydantic import BaseModel, Field, ValidationError, computed_field

from polar.void.metric.schemas import TimeInterval

DELTAS = {
    TimeInterval.hour: timedelta(hours=1),
    TimeInterval.day: timedelta(days=1),
    TimeInterval.week: timedelta(weeks=1),
}


class Subscription(BaseModel):
    id: str
    at: datetime
    anchor: datetime
    meter_interval: TimeInterval
    meter_interval_count: int = Field(default=1, ge=1)
    rollover_cap: float | None = Field(default=None, ge=0)
    included: float = Field(default=0, ge=0, allow_inf_nan=False)
    limit: Literal["hard", "soft", "unlimited"] = "hard"
    ended: bool = False


class MeterEvent(BaseModel):
    id: str
    at: datetime
    name: str
    data: dict[str, Any]


class MeterCycle(BaseModel):
    subscription_id: str
    period_start: datetime
    period_end: datetime
    credits: float
    usage: float
    expired: float
    rollover: float
    overage: float


class Ledger(BaseModel):
    """What one identity holds on a meter, drained by its subtree's usage."""

    at: datetime | None = None
    subscription: Subscription | None = None
    boundary: datetime | None = None
    boundaries: list[datetime] = Field(default_factory=list)
    cycles: dict[datetime, MeterCycle] = Field(default_factory=dict)
    credits: float = 0
    usage: float = 0


class State(Ledger):
    """The ledger seen on its own: remaining and overage from its own credits."""

    @computed_field  # type: ignore[prop-decorator]
    @property
    def remaining(self) -> float:
        return max(self.credits - self.usage, 0)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def overage(self) -> float:
        return max(self.usage - self.credits, 0)


def step(anchor: datetime, interval: TimeInterval, k: int) -> datetime:
    if interval in DELTAS:
        return anchor + DELTAS[interval] * k
    months = anchor.month - 1 + (k if interval == TimeInterval.month else 12 * k)
    year, month = anchor.year + months // 12, months % 12 + 1
    day = min(anchor.day, calendar.monthrange(year, month)[1])
    return anchor.replace(year=year, month=month, day=day)


def _meter_step(subscription: Subscription, k: int) -> datetime:
    return step(
        subscription.anchor,
        subscription.meter_interval,
        k * subscription.meter_interval_count,
    )


def _next_boundary(state: State) -> datetime | None:
    subscription = state.subscription
    if subscription is None or subscription.ended:
        return None
    floor = (
        max(subscription.at, state.boundary)
        if state.boundary is not None
        else subscription.at
    )
    if subscription.meter_interval in DELTAS:
        delta = DELTAS[subscription.meter_interval] * subscription.meter_interval_count
        k = max(0, math.ceil((floor - subscription.anchor) / delta))
    else:
        k = 0
        while _meter_step(subscription, k) < floor:
            k += 1
    boundary = _meter_step(subscription, k)
    if boundary == state.boundary:
        boundary = _meter_step(subscription, k + 1)
    return boundary


def _rollover(state: State) -> float:
    subscription = state.subscription
    assert subscription is not None
    rollover = state.remaining
    if subscription.rollover_cap is not None:
        rollover = min(rollover, subscription.rollover_cap)
    return rollover


def _advance(state: State, until: datetime) -> None:
    while (boundary := _next_boundary(state)) is not None and boundary <= until:
        assert state.subscription is not None
        if state.boundary is not None:
            rollover = _rollover(state)
            state.cycles[boundary] = MeterCycle(
                subscription_id=state.subscription.id,
                period_start=state.boundary,
                period_end=boundary,
                credits=state.credits,
                usage=state.usage,
                expired=state.remaining - rollover,
                rollover=rollover,
                overage=state.overage,
            )
            state.credits = rollover + state.subscription.included
            state.usage = 0
        state.boundary = boundary
        state.boundaries.append(boundary)


def _apply_stored_cycle(state: State, event: MeterEvent) -> None:
    if state.subscription is None or state.boundary != event.at:
        return
    try:
        stored = MeterCycle.model_validate(event.data)
    except ValidationError:
        return
    if stored.period_end != event.at:
        return
    if stored.subscription_id != state.subscription.id:
        return
    computed = state.cycles.get(event.at)
    if computed is None or computed.period_start != stored.period_start:
        return
    state.cycles[event.at] = stored
    state.credits = max(0, state.credits + stored.rollover - computed.rollover)


def _change(state: State, event: MeterEvent) -> None:
    subscription = state.subscription
    if event.name == "meter.cycled":
        _apply_stored_cycle(state, event)
        return
    if event.name == "subscription.cycled":
        return
    if event.name in ("subscription.canceled", "subscription.revoked"):
        if subscription is None:
            return
        subscription.ended = True
        subscription.at = event.at
        if event.name == "subscription.revoked":
            state.credits = 0
        return
    if event.name not in ("subscription.created", "subscription.updated"):
        return
    base = (
        subscription.model_dump()
        if subscription is not None and not subscription.ended
        else {"id": event.id, "anchor": event.at}
    )
    try:
        state.subscription = Subscription.model_validate(
            {**base, **event.data, "at": event.at, "ended": False}
        )
    except ValidationError:
        return
    previous = subscription.included if subscription and not subscription.ended else 0
    state.credits += max(0, state.subscription.included - previous)


def fold(
    state: State,
    events: list[MeterEvent],
    credits: list[tuple[datetime, float]],
    usage: list[tuple[datetime, float]],
    until: datetime,
) -> State:
    state = state.model_copy(deep=True)
    stream: list[tuple[datetime, int, Any]] = [
        (event.at, 0, event) for event in events if event.at <= until
    ]
    stream += [
        (timestamp, 1, value) for timestamp, value in credits if timestamp <= until
    ]
    stream += [(timestamp, 2, value) for timestamp, value in usage if timestamp < until]
    stream.sort(key=lambda item: item[:2])
    for timestamp, kind, item in stream:
        _advance(state, timestamp)
        if kind == 0:
            _change(state, item)
        elif kind == 1:
            state.credits = max(0, state.credits + item)
        else:
            state.usage += item
    _advance(state, until)
    state.at = until
    return state
