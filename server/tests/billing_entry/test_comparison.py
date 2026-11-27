from datetime import datetime, timedelta
from decimal import Decimal

import pytest
from pytest_mock import MockerFixture
from sqlalchemy import func, select

from polar.billing_entry.comparison import Adjustment, Quantities, compare, explain
from polar.enums import SubscriptionRecurringInterval
from polar.kit.utils import utc_now
from polar.meter.aggregation import AggregationFunction, PropertyAggregation
from polar.meter.filter import Filter, FilterConjunction
from polar.models import (
    BillingEntry,
    Customer,
    OrderItem,
    Organization,
    ProductPrice,
    ReducerBucket,
    Subscription,
)
from polar.models.billing_entry import BillingEntryDirection, BillingEntryType
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_active_subscription,
    create_event,
    create_meter,
    create_order,
    create_product,
    create_reducer,
)


def test_explain() -> None:
    reducer = Quantities(usage=Decimal(100), credits=Decimal(30), net=Decimal(70))

    assert explain(reducer, {}) == reducer
    assert explain(
        reducer,
        {
            "usage": Adjustment(usage=Decimal(-10)),
            "credits": Adjustment(credits=Decimal(20)),
            "net": Adjustment(net=Decimal(5)),
        },
    ) == Quantities(usage=Decimal(90), credits=Decimal(50), net=Decimal(45))


async def create_billed_usage(
    save_fixture: SaveFixture,
    *,
    customer: Customer,
    price: ProductPrice,
    subscription: Subscription,
    order_item: OrderItem,
    tokens: int,
    timestamp: datetime,
    ingested_at: datetime,
    external: bool,
) -> None:
    event = await create_event(
        save_fixture,
        organization=customer.organization,
        customer=None if external else customer,
        external_customer_id=customer.external_id if external else None,
        timestamp=timestamp,
        ingested_at=ingested_at,
        metadata={"tokens": tokens},
    )
    await save_fixture(
        BillingEntry(
            start_timestamp=timestamp,
            end_timestamp=timestamp,
            type=BillingEntryType.metered,
            direction=BillingEntryDirection.debit,
            customer=customer,
            product_price=price,
            subscription=subscription,
            event=event,
            order_item=order_item,
        )
    )


@pytest.mark.anyio
class TestCompare:
    @pytest.mark.parametrize("external", [False, True])
    async def test_carries_over_only_usage_billed_by_an_earlier_reducer_bill(
        self,
        external: bool,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
    ) -> None:
        customer.external_id = "external"
        await save_fixture(customer)
        meter = await create_meter(
            save_fixture,
            organization=organization,
            filter=Filter(conjunction=FilterConjunction.and_, clauses=[]),
            aggregation=PropertyAggregation(
                func=AggregationFunction.sum, property="tokens"
            ),
        )
        reducer = await create_reducer(
            save_fixture, organization=organization, meters=[meter]
        )
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(meter, Decimal(100), None, "usd")],
        )
        price = product.prices[0]
        subscription = await create_active_subscription(
            save_fixture, customer=customer, product=product
        )
        reset_at = (utc_now() - timedelta(days=1)).replace(
            minute=0, second=0, microsecond=0
        )
        previous_sealed_at = reset_at + timedelta(minutes=15)
        order_item = OrderItem(
            label="",
            amount=0,
            net_amount=0,
            tax_amount=0,
            product_price=price,
        )
        order = await create_order(
            save_fixture, customer=customer, order_items=[order_item]
        )
        await create_billed_usage(
            save_fixture,
            customer=customer,
            price=price,
            subscription=subscription,
            order_item=order_item,
            tokens=10,
            timestamp=reset_at - timedelta(minutes=1),
            ingested_at=reset_at + timedelta(minutes=5),
            external=external,
        )
        await create_billed_usage(
            save_fixture,
            customer=customer,
            price=price,
            subscription=subscription,
            order_item=order_item,
            tokens=5,
            timestamp=reset_at - timedelta(minutes=2),
            ingested_at=previous_sealed_at + timedelta(milliseconds=500),
            external=external,
        )
        await create_billed_usage(
            save_fixture,
            customer=customer,
            price=price,
            subscription=subscription,
            order_item=order_item,
            tokens=7,
            timestamp=reset_at + timedelta(hours=1),
            ingested_at=reset_at + timedelta(hours=1),
            external=external,
        )
        for generation, sealed_at, billed_at, billing_order in (
            (1, previous_sealed_at, previous_sealed_at + timedelta(seconds=1), None),
            (2, reset_at + timedelta(hours=2), utc_now(), order),
            (3, utc_now(), utc_now(), None),
        ):
            await save_fixture(
                ReducerBucket(
                    organization=organization,
                    reducer=reducer,
                    customer_id=None if external else customer.id,
                    external_customer_id=customer.external_id if external else None,
                    bucket_start=reset_at - timedelta(minutes=5),
                    bucket_end=reset_at,
                    generation=generation,
                    sealed_at=sealed_at,
                    billed_at=billed_at,
                    order=billing_order,
                )
            )
        mocker.patch(
            "polar.billing_entry.comparison.billing_interval_service.get_usage_windows",
            return_value=(),
        )

        comparison = await compare(
            session,
            subscription,
            meter,
            order.id,
            [order_item.id],
            legacy=Quantities(usage=Decimal(22), credits=Decimal(0), net=Decimal(22)),
            reducer=Quantities(usage=Decimal(12), credits=Decimal(0), net=Decimal(12)),
            cutoff=utc_now(),
        )

        assert comparison.adjustments == {
            "carried_over_usage": Adjustment(usage=Decimal(10))
        }
        assert comparison.match is True

    async def test_slow_explanation_leaves_the_session_usable(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
    ) -> None:
        meter = await create_meter(
            save_fixture,
            organization=organization,
            filter=Filter(conjunction=FilterConjunction.and_, clauses=[]),
            aggregation=PropertyAggregation(
                func=AggregationFunction.sum, property="tokens"
            ),
        )
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(meter, Decimal(100), None, "usd")],
        )
        subscription = await create_active_subscription(
            save_fixture, customer=customer, product=product
        )
        order = await create_order(save_fixture, customer=customer)
        mocker.patch(
            "polar.billing_entry.comparison.EXPLAIN_STATEMENT_TIMEOUT", "100ms"
        )

        async def sleep(
            session: AsyncSession, *args: object, **kwargs: object
        ) -> dict[str, Adjustment]:
            await session.execute(select(func.pg_sleep(5)))
            return {}

        mocker.patch(
            "polar.billing_entry.comparison._get_usage_adjustments", side_effect=sleep
        )
        log_exception = mocker.patch("polar.billing_entry.comparison.log.exception")

        comparison = await compare(
            session,
            subscription,
            meter,
            order.id,
            [],
            legacy=Quantities(usage=Decimal(22), credits=Decimal(0), net=Decimal(22)),
            reducer=Quantities(usage=Decimal(12), credits=Decimal(0), net=Decimal(12)),
            cutoff=utc_now(),
        )

        log_exception.assert_called_once()
        assert comparison.adjustments == {}
        assert (await session.execute(select(1))).scalar_one() == 1
