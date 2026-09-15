import asyncio
import sqlite3
import uuid
from datetime import UTC, datetime
from decimal import Decimal
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, Mock

import pytest
from sqlalchemy.dialects import sqlite

from polar.models import VoidBillingIdentity
from polar.models import VoidMeter as Meter
from polar.postgres import AsyncSession
from polar.void.identity.service import identity as identity_service
from polar.void.meter import service as meter_service_module
from polar.void.meter.balance import MeterCycle, MeterEvent
from polar.void.meter.service import MeterService, build_meter_cycle_event
from polar.void.tinybird import TinybirdApi


def test_build_meter_cycle_event_contains_complete_settlement() -> None:
    meter_id = uuid.uuid4()
    branch_id = uuid.uuid4()
    meter = Meter(
        id=meter_id,
        name="Tokens",
        slug="tokens",
        generation_id=4,
        variant_id="higher-price",
        branch_id=branch_id,
        usage_reducer_id=uuid.uuid4(),
        credit_reducer_id=uuid.uuid4(),
        unit_amount=Decimal("0.01"),
        currency="usd",
        organization_id=uuid.uuid4(),
    )
    period_start = datetime(2026, 1, 1, tzinfo=UTC)
    period_end = datetime(2026, 2, 1, tzinfo=UTC)
    cycle = MeterCycle(
        subscription_id="sub-1",
        period_start=period_start,
        period_end=period_end,
        credits=175,
        usage=180,
        expired=0,
        rollover=0,
        overage=5,
    )

    event = build_meter_cycle_event(meter, "customer-1", cycle)

    assert event.name == "meter.cycled"
    assert event.timestamp == period_end
    assert event.external_id == f"sub-1:{meter_id}:{period_end.isoformat()}"
    assert event.external_identity_id == "customer-1"
    assert event.metadata == {
        "meter_id": str(meter_id),
        "meter_generation_id": 4,
        "meter_variant_id": "higher-price",
        "meter_branch_id": str(branch_id),
        "unit_amount": "0.01",
        "currency": "usd",
        "subscription_id": "sub-1",
        "period_start": "2026-01-01T00:00:00Z",
        "period_end": "2026-02-01T00:00:00Z",
        "credits": 175.0,
        "usage": 180.0,
        "expired": 0.0,
        "rollover": 0.0,
        "overage": 5.0,
    }


@pytest.mark.parametrize(
    ("holder", "expected_credits", "expected_usage", "expected_remaining"),
    [("root", 100, 15, 85), ("child", 20, 15, 5)],
)
@pytest.mark.parametrize("prepaid", [False, True])
def test_child_limit_does_not_expand_parent_budget(
    monkeypatch: pytest.MonkeyPatch,
    holder: str,
    expected_credits: float,
    expected_usage: float,
    expected_remaining: float,
    prepaid: bool,
) -> None:
    meter = Mock(
        spec=Meter, credit_reducer_id=uuid.uuid4(), usage_reducer_id=uuid.uuid4()
    )
    jan1 = datetime(2026, 1, 1, tzinfo=UTC)
    jan2 = datetime(2026, 1, 2, tzinfo=UTC)
    nodes = {
        name: Mock(spec=VoidBillingIdentity, external_id=name, is_root=name == "root")
        for name in ("root", "child", "grandchild")
    }

    async def events(*args: object) -> list[MeterEvent]:
        if prepaid:
            return []
        return [
            MeterEvent(
                id="subscription",
                at=jan1,
                name="subscription.created",
                data={"meter_interval": "month"},
            )
        ]

    async def subtree(session: object, identity: SimpleNamespace) -> list[object]:
        assert identity.external_id == "child"
        return [nodes["child"], nodes["grandchild"]]

    # Execute the actual SQL predicates against parent, child, and unrelated rows.
    with sqlite3.connect(":memory:") as db:
        db.execute(
            "CREATE TABLE void_reducer_buckets "
            "(reducer_id TEXT, external_identity_id TEXT, external_root_id TEXT, "
            "value REAL)"
        )
        db.executemany(
            "INSERT INTO void_reducer_buckets VALUES (?, ?, ?, ?)",
            [
                (str(meter.credit_reducer_id), "root", "root", 100),
                (str(meter.credit_reducer_id), "child", "root", 20),
                (str(meter.credit_reducer_id), "other", "other", 500),
                (str(meter.usage_reducer_id), "child", "root", 10),
                (str(meter.usage_reducer_id), "grandchild", "root", 5),
                (str(meter.usage_reducer_id), "other", "other", 200),
            ],
        )

        async def values(
            session: Any,
            meter: Any,
            reducer_id: Any,
            condition: Any,
            edges: Any,
            start: Any,
            end: Any,
        ) -> Any:
            predicate = condition.compile(
                dialect=sqlite.dialect(), compile_kwargs={"literal_binds": True}
            )
            total = db.execute(
                f"SELECT SUM(value) FROM void_reducer_buckets WHERE {predicate} "
                "AND reducer_id = ?",
                (str(reducer_id),),
            ).fetchone()[0]
            return [(jan1, total or 0)]

        service = MeterService()
        monkeypatch.setattr(service, "_events", events)
        monkeypatch.setattr(service, "_reducer_values", values)
        monkeypatch.setattr(identity_service, "subtree", subtree)
        state, _, _ = asyncio.run(
            service._fold(
                Mock(spec=AsyncSession),
                Mock(spec=TinybirdApi),
                meter,
                nodes[holder],
                jan2,
            )
        )

    assert state.credits == expected_credits
    assert state.usage == expected_usage
    assert state.remaining == expected_remaining


@pytest.mark.parametrize(
    ("credits", "usage", "size", "allowed", "holder", "remaining"),
    [
        ({"root": 50}, {"root": 40, "child": 40}, 10, True, "root", 10),
        ({"root": 50}, {"root": 41, "child": 41}, 10, False, "root", 9),
        ({"root": 50}, {"root": 50, "child": 50}, 10, False, "root", 0),
        ({"root": 50, "child": 5}, {}, 10, False, "child", 5),
        ({"root": 5, "child": 50}, {}, 10, False, "root", 5),
        ({"root": 50, "child": 0}, {}, 10, False, "child", 0),
        ({}, {"root": 10, "child": 10}, 10, False, None, 0),
    ],
)
def test_prepaid_check_uses_every_credit_holder_without_subscriptions(
    monkeypatch: Any,
    credits: Any,
    usage: Any,
    size: Any,
    allowed: Any,
    holder: Any,
    remaining: Any,
) -> None:
    from polar.void.entitlement.service import entitlement

    monkeypatch.setattr(entitlement, "assignments", AsyncMock(return_value={}))
    service = MeterService()
    meter = Mock(
        spec=Meter,
        slug="credits",
        credit_reducer_id=uuid.uuid4(),
        usage_reducer_id=uuid.uuid4(),
    )
    nodes = [
        Mock(spec=VoidBillingIdentity, external_id=name) for name in ("child", "root")
    ]
    monkeypatch.setattr(service, "get", AsyncMock(return_value=meter))
    monkeypatch.setattr(service, "_events", AsyncMock(return_value=[]))
    monkeypatch.setattr(identity_service, "get", AsyncMock(return_value=nodes[0]))
    monkeypatch.setattr(identity_service, "chain", AsyncMock(return_value=nodes))

    async def identity_scope(session: Any, identity: Any) -> Any:
        return identity.external_id

    async def values(
        session: Any,
        meter: Any,
        reducer_id: Any,
        condition: Any,
        edges: Any,
        start: Any,
        end: Any,
    ) -> Any:
        assert edges == [meter_service_module.EPOCH]
        assert start == meter_service_module.EPOCH
        if reducer_id == meter.credit_reducer_id:
            identity = condition.right.value
            data = credits
        else:
            identity = condition
            data = usage
        return [(start, data[identity])] if identity in data else []

    monkeypatch.setattr(service, "_scope", identity_scope)
    monkeypatch.setattr(service, "_reducer_values", values)
    result = asyncio.run(
        service.check(
            Mock(spec=AsyncSession),
            Mock(spec=TinybirdApi),
            uuid.uuid4(),
            uuid.uuid4(),
            "child",
            size,
        )
    )
    assert result.allowed is allowed
    assert result.external_identity_id == holder
    assert result.remaining == remaining


@pytest.mark.parametrize(
    ("identity", "credits", "usage", "remaining", "limited_by"),
    [
        # The root holds the pool; its own view and the chain's agree.
        ("root", 50, 40, 10, "root"),
        # The child holds nothing, yet its remaining is what the root leaves it.
        ("child", 0, 40, 10, "root"),
    ],
)
def test_balance_reads_remaining_from_the_chain(
    monkeypatch: Any,
    identity: Any,
    credits: Any,
    usage: Any,
    remaining: Any,
    limited_by: Any,
) -> None:
    from polar.void.entitlement.service import entitlement

    monkeypatch.setattr(entitlement, "assignments", AsyncMock(return_value={}))
    service = MeterService()
    meter = Mock(
        spec=Meter,
        id=uuid.uuid4(),
        slug="credits",
        organization_id=uuid.uuid4(),
        credit_reducer_id=uuid.uuid4(),
        usage_reducer_id=uuid.uuid4(),
    )
    nodes = {
        name: Mock(spec=VoidBillingIdentity, external_id=name)
        for name in ("child", "root")
    }
    monkeypatch.setattr(service, "get", AsyncMock(return_value=meter))
    monkeypatch.setattr(service, "_events", AsyncMock(return_value=[]))
    monkeypatch.setattr(
        identity_service,
        "get",
        AsyncMock(return_value=nodes[identity]),
    )
    monkeypatch.setattr(
        identity_service,
        "chain",
        AsyncMock(return_value=[nodes["child"], nodes["root"]][identity == "root" :]),
    )

    async def identity_scope(session: Any, identity: Any) -> Any:
        return identity.external_id

    async def values(
        session: Any,
        meter: Any,
        reducer_id: Any,
        condition: Any,
        edges: Any,
        start: Any,
        end: Any,
    ) -> Any:
        if reducer_id == meter.credit_reducer_id:
            return [(start, 50)] if condition.right.value == "root" else []
        return [(start, 40)]  # the child spent it all; it counts at both levels

    monkeypatch.setattr(service, "_scope", identity_scope)
    monkeypatch.setattr(service, "_reducer_values", values)
    balance = asyncio.run(
        service.balance(
            Mock(spec=AsyncSession),
            Mock(spec=TinybirdApi),
            meter.organization_id,
            meter.id,
            identity,
        )
    )
    assert balance.external_identity_id == identity
    assert balance.credits == credits
    assert balance.usage == usage
    assert balance.remaining == remaining
    assert balance.limited_by == limited_by
    assert balance.limit == "hard"
    assert balance.reason == "ok"
    assert balance.overage == 0


def test_balance_reports_a_denied_meter(monkeypatch: Any) -> None:
    from polar.void.entitlement.schemas import EntitlementAssignment, MeterEntitlement
    from polar.void.entitlement.service import entitlement

    monkeypatch.setattr(
        entitlement,
        "assignments",
        AsyncMock(
            return_value={
                "child": EntitlementAssignment(
                    meters=[MeterEntitlement(meter="other", cap=None)]
                )
            }
        ),
    )
    service = MeterService()
    meter = Mock(
        spec=Meter,
        id=uuid.uuid4(),
        slug="credits",
        organization_id=uuid.uuid4(),
        credit_reducer_id=uuid.uuid4(),
        usage_reducer_id=uuid.uuid4(),
    )
    nodes = [
        Mock(spec=VoidBillingIdentity, external_id=name) for name in ("child", "root")
    ]
    monkeypatch.setattr(service, "get", AsyncMock(return_value=meter))
    monkeypatch.setattr(service, "_events", AsyncMock(return_value=[]))
    monkeypatch.setattr(identity_service, "get", AsyncMock(return_value=nodes[0]))
    monkeypatch.setattr(identity_service, "chain", AsyncMock(return_value=nodes))

    async def identity_scope(session: Any, identity: Any) -> Any:
        return identity.external_id

    async def values(
        session: Any,
        meter: Any,
        reducer_id: Any,
        condition: Any,
        edges: Any,
        start: Any,
        end: Any,
    ) -> Any:
        if reducer_id == meter.credit_reducer_id:
            return [(start, 50)] if condition.right.value == "root" else []
        return [(start, 3)]

    monkeypatch.setattr(service, "_scope", identity_scope)
    monkeypatch.setattr(service, "_reducer_values", values)
    balance = asyncio.run(
        service.balance(
            Mock(spec=AsyncSession),
            Mock(spec=TinybirdApi),
            meter.organization_id,
            meter.id,
            "child",
        )
    )
    assert balance.usage == 3
    assert balance.remaining == 0
    assert balance.reason == "access_denied"
    assert balance.limited_by == "child"
