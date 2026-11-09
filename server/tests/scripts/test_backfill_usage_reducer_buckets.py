from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Literal
from uuid import uuid4

import pytest
from sqlalchemy import select

from polar.event.system import SystemEvent
from polar.kit.db.postgres import AsyncSession
from polar.kit.utils import utc_now
from polar.meter.aggregation import AggregationFunction, PropertyAggregation
from polar.models import (
    BillingInterval,
    Customer,
    Meter,
    OrderItem,
    Organization,
    Product,
    ReducerBucket,
    User,
)
from polar.models.billing_entry import BillingEntryType
from polar.models.billing_interval import UsagePolicy
from polar.models.event import EventSource
from polar.models.organization import OrganizationStatus
from polar.models.reducer import ReducerKind
from polar.reducer.service import reducer as reducer_service
from polar.reducer.types import UsageWindow
from scripts.backfill_usage_reducer_buckets import (
    _get_organization_ids,
    backfill_organization,
)
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_account,
    create_billing_entry,
    create_event,
    create_meter,
    create_order,
    create_organization,
    create_product_price_metered_unit,
    create_reducer,
    create_subscription,
)

START = datetime(2026, 10, 1, 10, 0, tzinfo=UTC)
BUCKET = timedelta(minutes=5)
END = START + 3 * BUCKET
SUBSCRIPTION_START = START + timedelta(minutes=1)


@pytest.mark.anyio
class TestBackfillBuckets:
    async def test_billing_splits_generations_and_unbillable_usage(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        product: Product,
    ) -> None:
        meter = await create_meter(
            save_fixture,
            organization=organization,
            aggregation=PropertyAggregation(
                func=AggregationFunction.sum, property="tokens"
            ),
        )
        reducer = await create_reducer(
            save_fixture, organization=organization, meters=[meter]
        )
        price = await create_product_price_metered_unit(
            save_fixture, product=product, meter=meter
        )
        # A second meter on the same events, billed on its own schedule: its
        # entries are all still pending.
        count_meter = await create_meter(
            save_fixture, organization=organization, id=uuid4(), name="Count"
        )
        count_reducer = await create_reducer(
            save_fixture, organization=organization, meters=[count_meter]
        )
        count_price = await create_product_price_metered_unit(
            save_fixture, product=product, meter=count_meter
        )
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            started_at=SUBSCRIPTION_START,
        )
        await save_fixture(
            BillingInterval(
                organization=organization,
                subscription=subscription,
                customer=customer,
                meter=meter,
                product_price=price,
                period_start=SUBSCRIPTION_START,
                usage_policy=UsagePolicy.charge,
            )
        )
        order = await create_order(
            save_fixture,
            customer=customer,
            created_at=END + timedelta(minutes=15),
            order_items=[
                OrderItem(
                    label="",
                    amount=1000,
                    net_amount=1000,
                    tax_amount=0,
                    proration=False,
                    product_price=price,
                    start_timestamp=SUBSCRIPTION_START,
                    end_timestamp=START + BUCKET + timedelta(minutes=1),
                )
            ],
        )

        async def usage(
            timestamp: datetime,
            tokens: int,
            billing: Literal["ordered", "pending"] | None,
            name: str = "TEST_EVENT",
            ingested_at: datetime | None = None,
        ) -> None:
            event = await create_event(
                save_fixture,
                organization=organization,
                customer=customer,
                meter=meter if name == "TEST_EVENT" else None,
                name=name,
                timestamp=timestamp,
                ingested_at=ingested_at or timestamp,
                metadata={"tokens": tokens},
            )
            if billing is not None:
                await create_billing_entry(
                    save_fixture,
                    type=BillingEntryType.metered,
                    customer=customer,
                    product_price=price,
                    event=event,
                    order_item=order.items[0] if billing == "ordered" else None,
                )
                await create_billing_entry(
                    save_fixture,
                    type=BillingEntryType.metered,
                    customer=customer,
                    product_price=count_price,
                    event=event,
                )

        await usage(START + timedelta(seconds=30), 2, None)
        await usage(START + timedelta(minutes=3), 4, None)
        await usage(START + timedelta(minutes=4), 8, "ordered")
        late = order.created_at + timedelta(minutes=5)
        await usage(
            START + timedelta(minutes=4, seconds=30), 1, "pending", ingested_at=late
        )
        await usage(START + BUCKET + timedelta(minutes=1), 3, "ordered")
        await usage(
            START + BUCKET + timedelta(minutes=3), 5, "pending", ingested_at=late
        )
        await usage(START + 2 * BUCKET, 7, None)
        await usage(START - timedelta(seconds=1), 100, "ordered")
        await usage(END, 100, None)
        await usage(START, 100, None, name="not-matching")

        for _ in range(2):
            await backfill_organization(session, organization.id, START, END)
            buckets = (
                await session.scalars(
                    select(ReducerBucket)
                    .where(ReducerBucket.reducer_id == reducer.id)
                    .order_by(ReducerBucket.bucket_start, ReducerBucket.generation)
                )
            ).all()
            assert all(
                b.customer_id == customer.id
                and b.external_customer_id is None
                and b.synced_at == END
                and b.billed_at == b.sealed_at
                and b.order_id == (order.id if b.sealed_at else None)
                for b in buckets
            )
            assert [
                (
                    b.bucket_start,
                    b.bucket_end,
                    b.generation,
                    b.sealed_at,
                    b.count,
                    b.sum,
                    b.min,
                    b.max,
                )
                for b in buckets
            ] == [
                # Before the billing interval: never billed.
                (
                    START,
                    SUBSCRIPTION_START,
                    1,
                    None,
                    1,
                    Decimal(2),
                    Decimal(2),
                    Decimal(2),
                ),
                # Billed, with the unbilled event ingested before the order like
                # sync counts it, plus a late event that missed that billing.
                (
                    SUBSCRIPTION_START,
                    START + BUCKET,
                    1,
                    order.created_at,
                    2,
                    Decimal(12),
                    Decimal(4),
                    Decimal(8),
                ),
                (
                    SUBSCRIPTION_START,
                    START + BUCKET,
                    2,
                    None,
                    1,
                    Decimal(1),
                    Decimal(1),
                    Decimal(1),
                ),
                # Billed up to the previous cutoff, then pending: two generations,
                # the cutoff itself isn't reconstructed.
                (
                    START + BUCKET,
                    START + 2 * BUCKET,
                    1,
                    order.created_at,
                    1,
                    Decimal(3),
                    Decimal(3),
                    Decimal(3),
                ),
                (
                    START + BUCKET,
                    START + 2 * BUCKET,
                    2,
                    None,
                    1,
                    Decimal(5),
                    Decimal(5),
                    Decimal(5),
                ),
                # Usage with no billing entry.
                (
                    START + 2 * BUCKET,
                    END,
                    1,
                    None,
                    1,
                    Decimal(7),
                    Decimal(7),
                    Decimal(7),
                ),
            ]
            count_buckets = (
                await session.scalars(
                    select(ReducerBucket).where(
                        ReducerBucket.reducer_id == count_reducer.id
                    )
                )
            ).all()
            assert sum(b.count for b in count_buckets) == 7
            assert all(b.sealed_at is None for b in count_buckets)

        # Sync agrees: syncing each slot again leaves its buckets as they are.
        def snapshot() -> list[tuple[object, ...]]:
            return [
                (
                    b.bucket_start,
                    b.bucket_end,
                    b.generation,
                    b.sealed_at,
                    b.count,
                    b.sum,
                )
                for b in buckets
            ]

        backfilled = snapshot()
        for slot in (START, START + BUCKET, START + 2 * BUCKET):
            await reducer_service.sync_bucket(
                session, reducer.id, slot, customer.id, None
            )
        buckets = (
            await session.scalars(
                select(ReducerBucket)
                .where(ReducerBucket.reducer_id == reducer.id)
                .order_by(ReducerBucket.bucket_start, ReducerBucket.generation)
                .execution_options(populate_existing=True)
            )
        ).all()
        assert snapshot() == backfilled

        # The next billing bills everything still open since the interval
        # started: the late event, the pending one and the unbilled one. Usage
        # before the subscription stays open.
        next_order = await create_order(save_fixture, customer=customer)
        quantities = await reducer_service.bill(
            session,
            customer,
            [meter.id],
            order_id=next_order.id,
            windows=[UsageWindow(uuid4(), uuid4(), meter.id, SUBSCRIPTION_START, END)],
            cutoff=END,
        )
        assert quantities == {meter.id: (Decimal(13), Decimal(0))}
        buckets = (
            await session.scalars(
                select(ReducerBucket)
                .where(ReducerBucket.reducer_id == reducer.id)
                .order_by(ReducerBucket.bucket_start, ReducerBucket.generation)
            )
        ).all()
        assert [b.sealed_at is None for b in buckets] == [True] + [False] * 5
        assert [b.order_id for b in buckets] == [
            None,
            order.id,
            next_order.id,
            order.id,
            next_order.id,
            next_order.id,
        ]

    async def test_splits_at_meter_resets(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        meter: Meter,
    ) -> None:
        reducer = await create_reducer(
            save_fixture, organization=organization, meters=[meter]
        )
        reset_at = START + timedelta(minutes=2)
        # In a slot without events.
        empty_reset_at = START + BUCKET + timedelta(minutes=2)
        for at in (reset_at, empty_reset_at):
            await create_event(
                save_fixture,
                organization=organization,
                customer=customer,
                source=EventSource.system,
                name=SystemEvent.meter_reset,
                timestamp=at,
                metadata={"meter_id": str(meter.id)},
            )
        await create_event(
            save_fixture,
            organization=organization,
            customer=customer,
            timestamp=START + timedelta(minutes=1),
        )

        await backfill_organization(session, organization.id, START, END)

        async def get_buckets() -> list[tuple[datetime, datetime, int]]:
            buckets = (
                await session.scalars(
                    select(ReducerBucket)
                    .where(
                        ReducerBucket.reducer_id == reducer.id,
                        ReducerBucket.customer_id == customer.id,
                        ReducerBucket.external_customer_id.is_(None),
                    )
                    .order_by(ReducerBucket.bucket_start)
                    .execution_options(populate_existing=True)
                )
            ).all()
            return [(b.bucket_start, b.bucket_end, b.count) for b in buckets]

        # Each part of a split slot exists, empty or not, like a split creates it.
        assert await get_buckets() == [
            (START, reset_at, 1),
            (reset_at, START + BUCKET, 0),
            (START + BUCKET, empty_reset_at, 0),
            (empty_reset_at, START + 2 * BUCKET, 0),
        ]

        # So sync counts a late event in the empty part.
        await create_event(
            save_fixture,
            organization=organization,
            customer=customer,
            timestamp=START + timedelta(minutes=3),
        )
        await reducer_service.sync_bucket(session, reducer.id, START, customer.id, None)
        assert (await get_buckets())[1] == (reset_at, START + BUCKET, 1)

    async def test_keeps_credit_buckets(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        meter: Meter,
    ) -> None:
        await create_reducer(save_fixture, organization=organization, meters=[meter])
        credit_reducer = await create_reducer(
            save_fixture,
            organization=organization,
            meters=[meter],
            kind=ReducerKind.credit,
        )
        credit = ReducerBucket(
            organization=organization,
            reducer=credit_reducer,
            customer_id=customer.id,
            bucket_start=START,
            bucket_end=START + BUCKET,
            count=1,
            sum=Decimal(10),
        )
        await save_fixture(credit)

        await backfill_organization(session, organization.id, START, END)

        assert await session.get(ReducerBucket, credit.id) is not None


@pytest.mark.anyio
class TestGetOrganizationIds:
    async def test_skips_organizations_that_no_longer_bill(
        self, session: AsyncSession, save_fixture: SaveFixture, user: User
    ) -> None:
        organizations = {
            status: await create_organization(
                save_fixture, await create_account(save_fixture, user), status=status
            )
            for status in (
                OrganizationStatus.ACTIVE,
                OrganizationStatus.OFFBOARDING,
                OrganizationStatus.OFFBOARDED,
                OrganizationStatus.BLOCKED,
                OrganizationStatus.DENIED,
            )
        }
        deleted = await create_organization(
            save_fixture, await create_account(save_fixture, user)
        )
        deleted.deleted_at = utc_now()
        await save_fixture(deleted)
        for organization in (*organizations.values(), deleted):
            meter = await create_meter(
                save_fixture, organization=organization, id=uuid4()
            )
            await create_reducer(
                save_fixture, organization=organization, meters=[meter]
            )

        organization_ids = set(await _get_organization_ids(session, None, None))

        assert {
            organizations[OrganizationStatus.ACTIVE].id,
            organizations[OrganizationStatus.OFFBOARDING].id,
        } <= organization_ids
        assert not organization_ids & {
            organizations[OrganizationStatus.OFFBOARDED].id,
            organizations[OrganizationStatus.BLOCKED].id,
            organizations[OrganizationStatus.DENIED].id,
            deleted.id,
        }
