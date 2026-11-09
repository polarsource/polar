from datetime import timedelta

import pytest

from polar.enums import SubscriptionRecurringInterval
from polar.kit.db.postgres import AsyncSession
from polar.kit.utils import utc_now
from polar.meter.aggregation import (
    AggregationFunction,
    CountAggregation,
    PropertyAggregation,
)
from polar.models import BillingEntry, Customer, OrderItem, Organization
from polar.models.billing_entry import BillingEntryDirection, BillingEntryType
from polar.models.subscription import SubscriptionStatus
from polar.models.subscription_product_price import SubscriptionProductPrice
from scripts.soft_delete_overdue_metered_billing_entries import (
    candidate_statement,
    soft_delete_batch,
)
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_active_subscription,
    create_event,
    create_meter,
    create_order,
    create_product,
    create_product_price_metered_unit,
)


@pytest.mark.anyio
class TestSoftDeleteOverdueMeteredBillingEntries:
    @pytest.mark.parametrize(
        "scenario",
        [
            "sum",
            "count",
            "max",
            "current",
            "boundary",
            "active_price",
            "deleted",
            "static",
            "canceled",
            "deleted_subscription",
            "new_entry",
            "billed_after_preview",
            "renewed_after_preview",
            "deleted_price_link",
        ],
    )
    async def test_only_waives_overdue_pending_usage_on_former_prices(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        scenario: str,
    ) -> None:
        cutoff = utc_now()
        period_start = cutoff - timedelta(days=5)
        meter = await create_meter(
            save_fixture,
            organization=organization,
            aggregation=CountAggregation()
            if scenario == "count"
            else PropertyAggregation(
                func=AggregationFunction.max
                if scenario == "max"
                else AggregationFunction.sum,
                property="tokens",
            ),
        )
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[],
        )
        old_price = await create_product_price_metered_unit(
            save_fixture, product=product, meter=meter
        )
        current_price = await create_product_price_metered_unit(
            save_fixture, product=product, meter=meter
        )
        product.prices.append(current_price)
        product.all_prices.append(current_price)
        subscription = await create_active_subscription(
            save_fixture,
            customer=customer,
            product=product,
            prices=[current_price],
            current_period_start=period_start,
        )
        if scenario == "canceled":
            subscription.status = SubscriptionStatus.canceled
        elif scenario == "deleted_subscription":
            subscription.deleted_at = cutoff
        await save_fixture(subscription)
        if scenario == "deleted_price_link":
            old_link = SubscriptionProductPrice.from_price(old_price)
            old_link.subscription = subscription
            old_link.deleted_at = cutoff
            await save_fixture(old_link)

        entries = []
        for _ in range(2):
            timestamp = period_start - timedelta(days=1)
            if scenario == "boundary":
                timestamp = period_start
            elif scenario in {"current", "renewed_after_preview"}:
                timestamp = period_start + timedelta(days=1)
            event = await create_event(
                save_fixture,
                organization=organization,
                customer=customer,
                timestamp=timestamp,
            )
            entry = BillingEntry(
                customer=customer,
                subscription=subscription,
                product_price=current_price
                if scenario == "active_price"
                else old_price,
                event=event,
                start_timestamp=timestamp,
                end_timestamp=timestamp,
                type=BillingEntryType.cycle
                if scenario == "static"
                else BillingEntryType.metered,
                direction=BillingEntryDirection.debit,
                created_at=cutoff + timedelta(seconds=1)
                if scenario == "new_entry"
                else cutoff - timedelta(seconds=1),
                deleted_at=cutoff if scenario == "deleted" else None,
            )
            await save_fixture(entry)
            entries.append(entry)

        eligible = scenario in {
            "sum",
            "count",
            "billed_after_preview",
            "deleted_price_link",
        }
        selected = set(await session.scalars(candidate_statement(cutoff)))
        assert selected == ({entry.id for entry in entries} if eligible else set())

        if scenario == "billed_after_preview":
            order = await create_order(save_fixture, customer=customer)
            item = OrderItem(
                order=order,
                product_price=old_price,
                label="Usage",
                amount=100,
                net_amount=100,
                tax_amount=0,
            )
            await save_fixture(item)
            entries[0].order_item = item
            await save_fixture(entries[0])
        elif scenario == "renewed_after_preview":
            subscription.current_period_start = cutoff
            await save_fixture(subscription)

        updated = 0
        while count := await soft_delete_batch(
            session, subscription.id, period_start, cutoff, 1
        ):
            updated += count
        assert updated == (
            1 if scenario == "billed_after_preview" else 2 if eligible else 0
        )
        assert (
            await soft_delete_batch(session, subscription.id, period_start, cutoff, 1)
            == 0
        )
        for index, entry in enumerate(entries):
            await session.refresh(entry)
            should_delete = eligible and not (
                scenario == "billed_after_preview" and index == 0
            )
            assert (entry.deleted_at is not None) == (
                should_delete or scenario == "deleted"
            )
