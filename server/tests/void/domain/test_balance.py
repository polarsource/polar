import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pytest

from polar.void.meter.balance import MeterCycle, MeterEvent, State, fold, step
from polar.void.metric.schemas import TimeInterval

JAN1, JAN10, JAN20, JAN25, FEB1, FEB5, FEB10, FEB15, MAR1 = (
    datetime(2026, m, d, tzinfo=UTC)
    for m, d in [
        (1, 1),
        (1, 10),
        (1, 20),
        (1, 25),
        (2, 1),
        (2, 5),
        (2, 10),
        (2, 15),
        (3, 1),
    ]
)
START = MeterEvent(
    id="sub",
    at=JAN1,
    name="subscription.created",
    data={
        "billing_interval": "year",
        "meter_interval": "month",
        "rollover_cap": 100,
    },
)
JAN_CREDITS = [(JAN1, 100.0), (JAN20, 50.0)]
JAN_USAGE = [(JAN10, 70.0), (JAN25, 20.0)]


def test_cycle_records_complete_settlement() -> None:
    state = fold(State(), [START], JAN_CREDITS, JAN_USAGE, FEB1)

    assert state.cycles[FEB1] == MeterCycle(
        subscription_id="sub",
        period_start=JAN1,
        period_end=FEB1,
        credits=150,
        usage=90,
        expired=0,
        rollover=60,
        overage=0,
    )
    assert state.credits == 60
    assert state.usage == 0
    assert state.remaining == 60


def test_next_cycle_uses_rollover_and_new_credit_deltas() -> None:
    state = fold(
        State(),
        [START],
        [*JAN_CREDITS, (FEB1, 100.0)],
        [*JAN_USAGE, (FEB5, 30.0)],
        FEB10,
    )

    assert state.credits == 160
    assert state.usage == 30
    assert state.remaining == 130


def test_overage_is_scoped_to_meter_cycle() -> None:
    state = fold(
        State(),
        [START],
        [*JAN_CREDITS, (FEB1, 100.0), (MAR1, 100.0)],
        [*JAN_USAGE, (FEB5, 200.0)],
        MAR1,
    )

    assert state.cycles[MAR1].overage == 40
    assert state.overage == 0
    assert state.remaining == 100


def test_rollover_cap_zero_expires_unused_credits() -> None:
    start = START.model_copy(update={"data": {**START.data, "rollover_cap": 0}})
    state = fold(State(), [start], [(JAN1, 100.0)], JAN_USAGE, FEB1)

    assert state.cycles[FEB1].expired == 10
    assert state.cycles[FEB1].rollover == 0
    assert state.remaining == 0


def test_update_moves_meter_anchor() -> None:
    update = MeterEvent(
        id="u",
        at=FEB10,
        name="subscription.updated",
        data={"anchor": FEB15.isoformat()},
    )
    state = fold(
        State(),
        [START, update],
        [*JAN_CREDITS, (FEB1, 100.0)],
        JAN_USAGE,
        MAR1,
    )

    assert state.boundary == FEB15
    assert state.cycles[FEB15].period_start == FEB1


def test_canceled_subscription_stops_new_meter_cycles() -> None:
    cancel = MeterEvent(id="c", at=FEB10, name="subscription.canceled", data={})
    state = fold(State(), [START, cancel], JAN_CREDITS, JAN_USAGE, MAR1)

    assert list(state.cycles) == [FEB1]
    assert state.subscription is not None
    assert state.subscription.ended


def test_revoked_subscription_removes_remaining_credits() -> None:
    revoke = MeterEvent(id="r", at=FEB10, name="subscription.revoked", data={})
    state = fold(State(), [START, revoke], JAN_CREDITS, JAN_USAGE, MAR1)

    assert state.remaining == 0


def test_billing_cycle_does_not_drive_meter_cycle() -> None:
    billed = MeterEvent(id="bill", at=JAN20, name="subscription.cycled", data={})
    state = fold(State(), [START, billed], JAN_CREDITS, JAN_USAGE, FEB10)

    assert state.boundaries == [JAN1, FEB1]
    assert state.cycles[FEB1].period_start == JAN1


def test_stored_meter_cycle_settlement_wins() -> None:
    stored = MeterCycle(
        subscription_id="sub",
        period_start=JAN1,
        period_end=FEB1,
        credits=100,
        usage=97,
        expired=0,
        rollover=3,
        overage=0,
    )
    cycled = MeterEvent(
        id="cycle",
        at=FEB1,
        name="meter.cycled",
        data=stored.model_dump(mode="json"),
    )
    state = fold(State(), [START, cycled], [(JAN1, 100.0)], JAN_USAGE, FEB10)

    assert state.cycles == {FEB1: stored}
    assert state.remaining == 3


def test_incomplete_meter_cycle_is_ignored() -> None:
    cycled = MeterEvent(id="cycle", at=FEB1, name="meter.cycled", data={"rollover": 3})
    state = fold(State(), [START, cycled], [(JAN1, 100.0)], JAN_USAGE, FEB10)

    assert state.cycles[FEB1].rollover == 10


def test_meter_interval_count() -> None:
    start = START.model_copy(update={"data": {**START.data, "meter_interval_count": 3}})
    state = fold(State(), [start], [(JAN1, 100.0)], [], MAR1)

    assert state.boundaries == [JAN1]
    assert state.cycles == {}


def test_invalid_change_is_skipped() -> None:
    orphan = MeterEvent(id="o", at=JAN1, name="subscription.updated", data={})
    state = fold(State(), [orphan], [], [], FEB1)

    assert state.subscription is None


def test_negative_credit_delta_does_not_make_limit_negative() -> None:
    state = fold(State(), [START], [(JAN1, 100.0), (JAN20, -150.0)], [], JAN25)

    assert state.credits == 0
    assert state.remaining == 0


def test_step_clamps_month_end() -> None:
    jan31 = datetime(2026, 1, 31, tzinfo=UTC)
    assert step(jan31, TimeInterval.month, 1) == datetime(2026, 2, 28, tzinfo=UTC)
    assert step(jan31, TimeInterval.month, 13) == datetime(2027, 2, 28, tzinfo=UTC)
    assert step(jan31, TimeInterval.year, 1) == datetime(2027, 1, 31, tzinfo=UTC)


RECONCILIATION_CASES = json.loads(
    (
        Path(__file__).resolve().parents[4]
        / "clients/packages/void-sdk/test/fixtures/meter_reconciliation.json"
    ).read_text()
)


@pytest.mark.parametrize("case", RECONCILIATION_CASES, ids=lambda case: case["name"])
def test_sdk_reconciliation_parity(case: dict[str, Any]) -> None:
    state = fold(
        State(),
        [MeterEvent.model_validate(event) for event in case["events"]],
        [(datetime.fromisoformat(at), value) for at, value in case["credits"]],
        [(datetime.fromisoformat(at), value) for at, value in case["usage"]],
        datetime.fromisoformat(case["until"]),
    )
    assert state.model_dump(mode="json") == case["expected"]
