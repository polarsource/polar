import json
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any
from unittest.mock import Mock

import pytest
import pytest_asyncio
from sqlalchemy import select

from polar.exceptions import ResourceNotFound
from polar.models import Organization, VoidEvent, VoidMeter, VoidReducerBucket
from polar.postgres import AsyncSession
from polar.void.event.schemas import EventCreate, EventSource
from polar.void.event.service import event as event_service
from polar.void.identity.schemas import IdentityCreate
from polar.void.identity.service import identity as identity_service
from polar.void.meter.schemas import MeterCreate
from polar.void.meter.service import meter as meter_service
from polar.void.reducer.schemas import ReducerCreate
from polar.void.reducer.service import reducer as reducer_service
from polar.void.tinybird import TinybirdApi

JAN1 = datetime(2026, 1, 1, tzinfo=UTC)
FEB1 = datetime(2026, 2, 1, tzinfo=UTC)
FEB10 = datetime(2026, 2, 10, tzinfo=UTC)


@pytest_asyncio.fixture
async def meter(session: AsyncSession, organization: Organization) -> VoidMeter:
    reducers = []
    for slug, aggregation in [
        ("usage", {"func": "count"}),
        ("credits", {"func": "sum", "property": "metadata.amount"}),
    ]:
        reducers.append(
            await reducer_service.create(
                session,
                organization.id,
                ReducerCreate.model_validate(
                    {
                        "slug": slug,
                        "filter": {"conjunction": "and", "clauses": []},
                        "aggregation": aggregation,
                    }
                ),
            )
        )
    return await meter_service.create(
        session,
        organization.id,
        MeterCreate(
            slug="requests",
            name="Requests",
            usage_reducer_id=reducers[0].id,
            credit_reducer_id=reducers[1].id,
            unit_amount=Decimal("0.01"),
        ),
    )


@pytest.mark.asyncio
class TestRuntime:
    async def test_balances_scope_credits_to_holder_and_usage_to_subtree(
        self,
        session: AsyncSession,
        organization: Organization,
        organization_second: Organization,
        meter: VoidMeter,
    ) -> None:
        root, _ = await identity_service.ensure(
            session, organization, IdentityCreate(external_id="root")
        )
        child, _ = await identity_service.ensure(
            session,
            organization,
            IdentityCreate(external_id="child", parent_external_id="root"),
        )
        await identity_service.ensure(
            session,
            organization,
            IdentityCreate(external_id="grandchild", parent_external_id="child"),
        )
        for reducer, actor, value in [
            (meter.credit_reducer, "root", 100),
            (meter.credit_reducer, "child", 20),
            (meter.usage_reducer, "child", 10),
            (meter.usage_reducer, "grandchild", 5),
        ]:
            session.add(
                VoidReducerBucket(
                    organization=organization,
                    reducer=reducer,
                    external_identity_id=actor,
                    external_root_id="root",
                    bucket_start=JAN1,
                    value=value,
                )
            )
        await session.flush()
        tinybird = Mock(spec=TinybirdApi)
        tinybird.query.return_value = {"data": []}
        root_balance = await meter_service.balance(
            session, tinybird, organization.id, meter.id, root.external_id, FEB10
        )
        child_balance = await meter_service.balance(
            session, tinybird, organization.id, meter.id, child.external_id, FEB10
        )
        assert (root_balance.credits, root_balance.usage, root_balance.remaining) == (
            100,
            15,
            85,
        )
        assert (
            child_balance.credits,
            child_balance.usage,
            child_balance.remaining,
        ) == (20, 15, 5)
        assert child_balance.limited_by == "child"
        with pytest.raises(ResourceNotFound):
            await meter_service.balance(
                session, tinybird, organization_second.id, meter.id, "root", FEB10
            )

    async def test_settled_cycle_keeps_recorded_rollover(
        self,
        session: AsyncSession,
        organization: Organization,
        meter: VoidMeter,
    ) -> None:
        root, _ = await identity_service.ensure(
            session, organization, IdentityCreate(external_id="root")
        )
        session.add(
            VoidReducerBucket(
                organization=organization,
                reducer=meter.usage_reducer,
                external_identity_id="root",
                external_root_id="root",
                bucket_start=FEB1,
                value=20,
            )
        )
        await session.flush()
        tinybird = Mock(spec=TinybirdApi)
        tinybird.query.return_value = {
            "data": [
                {
                    "external_id": "sub",
                    "timestamp": JAN1.isoformat(),
                    "name": "subscription.created",
                    "metadata": json.dumps(
                        {"meter_interval": "month", "included": 100}
                    ),
                },
                {
                    "external_id": "cycle",
                    "timestamp": FEB1.isoformat(),
                    "name": "meter.cycled",
                    "metadata": json.dumps(
                        {
                            "subscription_id": "sub",
                            "period_start": JAN1.isoformat(),
                            "period_end": FEB1.isoformat(),
                            "credits": 100,
                            "usage": 90,
                            "expired": 0,
                            "rollover": 10,
                            "overage": 0,
                        }
                    ),
                },
            ]
        }
        state, _, _ = await meter_service._fold(session, tinybird, meter, root, FEB10)
        assert state.cycles[FEB1].usage == 90
        assert (state.credits, state.usage, state.remaining) == (110, 20, 90)

    async def test_cycle_settles_authoritative_usage_before_postgres_reducers_catch_up(
        self,
        session: AsyncSession,
        organization: Organization,
        meter: VoidMeter,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        await identity_service.ensure(
            session, organization, IdentityCreate(external_id="root")
        )
        monkeypatch.setattr("polar.void.meter.service.utc_now", lambda: FEB10)
        tinybird = Mock(spec=TinybirdApi)

        def query(pipe: str, params: dict[str, Any]) -> dict[str, Any]:
            assert params["organization_id"] == str(organization.id)
            if pipe == "void_meter_active_subscriptions":
                return {
                    "data": [
                        {"meter_id": str(meter.id), "external_identity_id": "root"}
                    ]
                }
            if pipe == "void_reducer_buckets":
                if params["func"] == "sum":
                    return {"data": []}
                return {
                    "data": [
                        {
                            "external_identity_id": "root",
                            "external_root_id": "root",
                            "bucket_start": JAN1.isoformat(),
                            "value": 135,
                        },
                        {
                            "external_identity_id": "other",
                            "external_root_id": "other",
                            "bucket_start": JAN1.isoformat(),
                            "value": 999,
                        },
                    ]
                }
            assert pipe == "void_meter_subscriptions"
            return {
                "data": [
                    {
                        "external_id": "sub",
                        "timestamp": JAN1.isoformat(),
                        "name": "subscription.created",
                        "metadata": json.dumps(
                            {
                                "meter_interval": "month",
                                "included": 100,
                                "rollover_cap": 10,
                            }
                        ),
                    }
                ]
            }

        tinybird.query.side_effect = query
        assert await meter_service.cycle(session, tinybird, organization.id) == 1
        assert await meter_service.cycle(session, tinybird, organization.id) == 0
        events = (
            await session.scalars(
                select(VoidEvent).where(VoidEvent.organization_id == organization.id)
            )
        ).all()
        assert len(events) == 1
        assert events[0].delivered_at is None
        metadata = json.loads(events[0].payload["metadata"])
        assert metadata["credits"] == 100
        assert metadata["usage"] == 135
        assert metadata["overage"] == 35
        assert metadata["expired"] == 0
        assert metadata["rollover"] == 0
        events[0].delivered_at = FEB10
        await session.flush()
        assert await meter_service.cycle(session, tinybird, organization.id) == 0
        assert metadata["unit_amount"] == "0.01"

    async def test_pending_accepted_events_defer_settlement(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        await event_service.ingest(
            session,
            organization.id,
            [EventCreate(name="usage", external_id="pending", timestamp=JAN1)],
            EventSource.user,
        )
        tinybird = Mock(spec=TinybirdApi)
        assert await meter_service.cycle(session, tinybird, organization.id) == 0
        tinybird.query.assert_not_called()
