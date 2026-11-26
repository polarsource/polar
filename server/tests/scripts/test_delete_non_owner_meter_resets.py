import uuid
from datetime import datetime, timedelta
from decimal import Decimal

import pytest
from sqlalchemy import select

from polar.event.repository import EventRepository
from polar.event.system import SystemEvent
from polar.kit.db.postgres import AsyncSession
from polar.kit.utils import utc_now
from polar.models import (
    Customer,
    CustomerMeter,
    Meter,
    Organization,
    Product,
    Subscription,
)
from polar.models.benefit import BenefitType
from polar.models.event import EventSource
from polar.models.order import OrderBillingReasonInternal
from polar.models.subscription import SubscriptionStatus
from polar.redis import Redis
from polar.reducer.service import reducer as reducer_service
from scripts.delete_non_owner_meter_resets import DeletionMismatch, delete_resets, find
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_active_subscription,
    create_benefit,
    create_benefit_grant,
    create_event,
    create_meter,
    create_order,
)


async def reset_and_credit(
    save_fixture: SaveFixture,
    organization: Organization,
    customer: Customer,
    meter: Meter,
    at: datetime,
    *,
    credited: bool = True,
) -> None:
    await create_event(
        save_fixture,
        organization=organization,
        customer=customer,
        source=EventSource.system,
        name=SystemEvent.meter_reset,
        timestamp=at,
        ingested_at=at,
        metadata={"meter_id": str(meter.id)},
    )
    if not credited:
        return
    await create_event(
        save_fixture,
        organization=organization,
        customer=customer,
        source=EventSource.system,
        name=SystemEvent.meter_credited,
        timestamp=at + timedelta(minutes=1),
        ingested_at=at + timedelta(minutes=1),
        metadata={"meter_id": str(meter.id), "units": 100, "rollover": False},
    )


async def setup_shared_meter(
    save_fixture: SaveFixture,
    session: AsyncSession,
    organization: Organization,
    customer: Customer,
    meter: Meter,
    product: Product,
    *,
    later_renewed: bool,
    backfilled: bool = False,
    credited: bool = True,
) -> tuple[CustomerMeter, datetime]:
    """An owner renewed 10 days ago and a later subscription renewed 5 days ago,
    both crediting the meter 100 units and resetting it. A backfilled credit
    reducer only synced its credits after both resets."""
    await reducer_service.sync_meter(session, meter)
    now = utc_now()
    owner_renewal = now - timedelta(days=10)
    later_renewal = now - timedelta(days=5)
    owner = await create_active_subscription(
        save_fixture,
        product=product,
        customer=customer,
        started_at=now - timedelta(days=30),
        current_period_start=owner_renewal,
    )
    later = await create_active_subscription(
        save_fixture,
        product=product,
        customer=customer,
        started_at=now - timedelta(days=20),
        current_period_start=later_renewal,
    )
    benefit = await create_benefit(
        save_fixture,
        organization=organization,
        type=BenefitType.meter_credit,
        properties={"meter_id": str(meter.id), "units": 100, "rollover": False},
    )
    for subscription in (owner, later):
        await create_benefit_grant(
            save_fixture, customer, benefit, granted=True, subscription=subscription
        )
    for renewal in (owner_renewal, later_renewal):
        await reset_and_credit(
            save_fixture, organization, customer, meter, renewal, credited=credited
        )
        if not backfilled:
            await reducer_service.sync_credits(session, customer, meter.id)
    if backfilled:
        await reducer_service.sync_credits(session, customer, meter.id)
    if later_renewed:
        await create_order(
            save_fixture,
            customer=customer,
            product=product,
            subscription=later,
            billing_reason=OrderBillingReasonInternal.subscription_cycle,
            created_at=later_renewal,
        )
    customer_meter = CustomerMeter(
        customer=customer,
        meter=meter,
        activated_at=owner_renewal,
        consumed_units=Decimal(0),
        credited_units=100 if credited else 0,
        balance=Decimal(100 if credited else 0),
    )
    await save_fixture(customer_meter)
    return customer_meter, owner_renewal


@pytest.mark.anyio
class TestDeleteResets:
    @pytest.mark.parametrize("backfilled", [False, True])
    async def test_deletes_reset_of_later_renewal(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        meter: Meter,
        product: Product,
        backfilled: bool,
    ) -> None:
        customer_meter, owner_renewal = await setup_shared_meter(
            save_fixture,
            session,
            organization,
            customer,
            meter,
            product,
            later_renewed=True,
            backfilled=backfilled,
        )
        [(_, reducer_before)] = await reducer_service.get_customer_meter_units(
            session, redis, [(customer, meter.id)]
        )
        assert reducer_before == 100

        result = await delete_resets(session, redis, customer_meter.id)

        assert len(result["deleted"]) == 1
        latest = await EventRepository.from_session(session).get_latest_meter_reset(
            customer, meter.id
        )
        assert latest is not None
        assert latest.timestamp == owner_renewal
        assert customer_meter.credited_units == 200
        [(_, reducer_after)] = await reducer_service.get_customer_meter_units(
            session, redis, [(customer, meter.id)]
        )
        assert reducer_after == 200
        assert await find(session) == []

    async def test_keeps_reset_that_is_last_billed_event(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        meter: Meter,
        product: Product,
    ) -> None:
        customer_meter, _ = await setup_shared_meter(
            save_fixture,
            session,
            organization,
            customer,
            meter,
            product,
            later_renewed=True,
        )
        meter.last_billed_event = await EventRepository.from_session(
            session
        ).get_latest_meter_reset(customer, meter.id)
        await save_fixture(meter)

        with pytest.raises(DeletionMismatch):
            await delete_resets(session, redis, customer_meter.id)

    async def test_keeps_reset_not_from_a_later_renewal(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        meter: Meter,
        product: Product,
    ) -> None:
        customer_meter, _ = await setup_shared_meter(
            save_fixture,
            session,
            organization,
            customer,
            meter,
            product,
            later_renewed=False,
        )

        with pytest.raises(DeletionMismatch):
            await delete_resets(session, redis, customer_meter.id)

    async def test_deletes_reset_on_meter_without_credits(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        meter: Meter,
        product: Product,
    ) -> None:
        customer_meter, _ = await setup_shared_meter(
            save_fixture,
            session,
            organization,
            customer,
            meter,
            product,
            later_renewed=True,
            credited=False,
        )

        result = await delete_resets(session, redis, customer_meter.id)

        assert len(result["deleted"]) == 1
        assert customer_meter.credited_units == 0


@pytest.mark.anyio
class TestFind:
    async def test_finds_reset_since_owner_renewal(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        meter: Meter,
        product: Product,
    ) -> None:
        customer_meter, _ = await setup_shared_meter(
            save_fixture,
            session,
            organization,
            customer,
            meter,
            product,
            later_renewed=True,
        )

        assert await find(session) == [customer_meter.id]

    async def test_ignores_meter_no_subscription_owns(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        meter: Meter,
        product: Product,
    ) -> None:
        customer_meter, _ = await setup_shared_meter(
            save_fixture,
            session,
            organization,
            customer,
            meter,
            product,
            later_renewed=True,
        )
        unowned = await create_meter(
            save_fixture, organization=organization, id=uuid.uuid4()
        )
        await reset_and_credit(
            save_fixture, organization, customer, unowned, utc_now(), credited=False
        )
        await save_fixture(
            CustomerMeter(
                customer=customer,
                meter=unowned,
                consumed_units=Decimal(0),
                credited_units=0,
                balance=Decimal(0),
            )
        )

        assert await find(session) == [customer_meter.id]

    async def test_finds_reset_by_ended_subscription(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        meter: Meter,
        product: Product,
    ) -> None:
        customer_meter, _ = await setup_shared_meter(
            save_fixture,
            session,
            organization,
            customer,
            meter,
            product,
            later_renewed=True,
        )
        later = await session.scalar(
            select(Subscription)
            .where(Subscription.customer_id == customer.id)
            .order_by(Subscription.started_at.desc())
            .limit(1)
        )
        assert later is not None
        later.status = SubscriptionStatus.canceled
        later.ended_at = utc_now()
        await save_fixture(later)

        assert await find(session) == [customer_meter.id]
