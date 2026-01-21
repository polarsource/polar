import contextlib
import dataclasses
import uuid
from collections.abc import Sequence
from datetime import datetime
from typing import cast

import structlog
from babel.dates import format_date
from sqlalchemy.util.typing import Literal
from typing_extensions import AsyncGenerator

from polar.event.repository import EventRepository
from polar.kit.math import non_negative_running_sum
from polar.meter.service import meter as meter_service
from polar.models import BillingEntry, Event, OrderItem, Subscription
from polar.models.billing_entry import BillingEntryDirection, BillingEntryType
from polar.models.event import EventSource
from polar.postgres import AsyncSession
from polar.product.guard import (
    MeteredPrice,
    StaticPrice,
    is_metered_price,
)
from polar.product.repository import ProductPriceRepository, ProductRepository

from .repository import BillingEntryRepository

log = structlog.get_logger(__name__)


@dataclasses.dataclass
class StaticLineItem:
    price: StaticPrice
    amount: int
    currency: str
    label: str
    proration: bool


@dataclasses.dataclass
class MeteredLineItem:
    price: MeteredPrice
    start_timestamp: datetime
    end_timestamp: datetime
    consumed_units: float
    credited_units: int
    amount: int
    currency: str
    label: str
    proration: Literal[False] = False


class BillingEntryService:
    @contextlib.asynccontextmanager
    async def create_order_items_from_pending(
        self, session: AsyncSession, subscription: Subscription
    ) -> AsyncGenerator[Sequence[OrderItem]]:
        item_entries_map: dict[OrderItem, Sequence[uuid.UUID]] = {}
        async for line_item, entries in self.compute_pending_subscription_line_items(
            session, subscription
        ):
            order_item = OrderItem(
                id=uuid.uuid4(),
                label=line_item.label,
                amount=line_item.amount,
                tax_amount=0,
                proration=line_item.proration,
                product_price=line_item.price,
            )
            item_entries_map[order_item] = entries

        yield list(item_entries_map.keys())

        repository = BillingEntryRepository.from_session(session)
        for order_item, entries in item_entries_map.items():
            await repository.update_order_item_id(entries, order_item.id)

    async def compute_pending_subscription_line_items(
        self, session: AsyncSession, subscription: Subscription
    ) -> AsyncGenerator[tuple[StaticLineItem | MeteredLineItem, Sequence[uuid.UUID]]]:
        repository = BillingEntryRepository.from_session(session)

        async for entry in repository.get_static_pending_by_subscription(
            subscription.id
        ):
            static_price = cast(StaticPrice, entry.product_price)
            static_line_item = await self._get_static_price_line_item(
                session, static_price, entry
            )
            yield static_line_item, [entry.id]

        # 👋 Reading the code below, you might wonder:
        # "Why is this so complex?"
        # "Why are there so many queries?"
        # Well, if you look at the previous implementation, it was much more readable
        # but it involved to load lot of BillingEntry in memory, which was causing
        # performance issues and even OOM on large subscriptions.
        product_price_repository = ProductPriceRepository.from_session(session)

        # Track which meters we've already processed to avoid duplicates
        # For non-summable aggregations (max, min, avg, unique), we process each meter only once
        # (even if there are billing entries with multiple prices) because these aggregations
        # must be computed across ALL events, not per-price
        processed_meters: set[uuid.UUID] = set()

        async for (
            product_price_id,
            meter_id,
            start_timestamp,
            end_timestamp,
        ) in repository.get_pending_metered_by_subscription_tuples(subscription.id):
            metered_price = cast(
                MeteredPrice, await product_price_repository.get_by_id(product_price_id)
            )

            # Check if this meter uses a non-summable aggregation
            # Non-summable aggregations (max, min, avg, unique) must be computed across
            # ALL events in the period, not per-price. For example:
            # - MAX(3 servers on priceA, 2 servers on priceB) = 3 servers (not 3+2=5)
            # - We bill this at the currently active price from subscription
            if not metered_price.meter.aggregation.is_summable():
                if meter_id in processed_meters:
                    continue
                processed_meters.add(meter_id)

                # Find the currently active price for this meter from the subscription
                # This is the source of truth - even if all billing entries used priceA,
                # if the customer changed to priceB, we bill at priceB
                active_price = None
                for spp in subscription.subscription_product_prices:
                    if (
                        is_metered_price(spp.product_price)
                        and spp.product_price.meter_id == meter_id
                    ):
                        active_price = spp.product_price
                        break

                if active_price is None:
                    log.info(
                        f"No active price found for meter {meter_id} in subscription {subscription.id}"
                    )
                    continue

                metered_line_item = await self._get_metered_line_item_by_meter(
                    session, active_price, subscription, start_timestamp, end_timestamp
                )
                pending_entries_ids = (
                    await repository.get_pending_ids_by_subscription_and_meter(
                        subscription.id, meter_id
                    )
                )
            else:
                metered_line_item = await self._get_metered_line_item(
                    session, metered_price, subscription, start_timestamp, end_timestamp
                )
                pending_entries_ids = (
                    await repository.get_pending_ids_by_subscription_and_price(
                        subscription.id, product_price_id
                    )
                )

            yield metered_line_item, pending_entries_ids

    async def _get_static_price_line_item(
        self, session: AsyncSession, price: StaticPrice, entry: BillingEntry
    ) -> StaticLineItem:
        assert entry.amount is not None
        assert entry.currency is not None

        product_repository = ProductRepository.from_session(session)
        product = await product_repository.get_by_id(price.product_id)
        assert product is not None

        start = format_date(entry.start_timestamp.date(), locale="en_US")
        end = format_date(entry.end_timestamp.date(), locale="en_US")
        amount = entry.amount

        if entry.direction == BillingEntryDirection.credit:
            label = f"Remaining time on {product.name} — From {start} to {end}"
            amount = -amount
        elif entry.direction == BillingEntryDirection.debit:
            label = f"{product.name} — From {start} to {end}"
            amount = amount

        return StaticLineItem(
            price=price,
            amount=amount,
            currency=entry.currency,
            label=label,
            proration=entry.type == BillingEntryType.proration,
        )

    async def _get_metered_line_item(
        self,
        session: AsyncSession,
        price: MeteredPrice,
        subscription: Subscription,
        start_timestamp: datetime,
        end_timestamp: datetime,
    ) -> MeteredLineItem:
        """
        Compute a metered line item for a specific price.
        Used for summable aggregations (sum, count) where we can group by price.
        """
        event_repository = EventRepository.from_session(session)
        events_statement = event_repository.get_by_pending_entries_statement(
            subscription.id, price.id
        )
        meter = price.meter
        units = await meter_service.get_quantity(
            session,
            meter,
            events_statement.where(
                # Combining these two WHERE clauses allows us to hit a composite index
                Event.organization_id == meter.organization_id,
                Event.source == EventSource.user,
            ),
        )
        credit_events_statement = events_statement.where(
            Event.is_meter_credit.is_(True)
        )
        credit_events = await event_repository.get_all(credit_events_statement)
        credited_units = non_negative_running_sum(
            event.user_metadata["units"] for event in credit_events
        )
        amount, amount_label = price.get_amount_and_label(units - credited_units)
        label = f"{meter.name} — {amount_label}"

        return MeteredLineItem(
            price=price,
            start_timestamp=start_timestamp,
            end_timestamp=end_timestamp,
            consumed_units=units,
            credited_units=credited_units,
            amount=amount,
            currency=price.price_currency,
            label=label,
        )

    async def _get_metered_line_item_by_meter(
        self,
        session: AsyncSession,
        price: MeteredPrice,
        subscription: Subscription,
        start_timestamp: datetime,
        end_timestamp: datetime,
    ) -> MeteredLineItem:
        """
        Compute a metered line item grouped by meter.
        Used for non-summable aggregations (max, min, avg, unique) where we must
        compute across ALL events for the meter, regardless of which price was active.
        Uses the provided price for billing (should be the most recent/current price).
        """
        event_repository = EventRepository.from_session(session)
        meter = price.meter

        # Get events across ALL prices for this meter
        events_statement = event_repository.get_by_pending_entries_for_meter_statement(
            subscription.id, meter.id
        )
        units = await meter_service.get_quantity(
            session,
            meter,
            events_statement.where(
                # Combining these two WHERE clauses allows us to hit a composite index
                Event.organization_id == meter.organization_id,
                Event.source == EventSource.user,
            ),
        )
        credit_events_statement = events_statement.where(
            Event.is_meter_credit.is_(True)
        )
        credit_events = await event_repository.get_all(credit_events_statement)
        credited_units = non_negative_running_sum(
            event.user_metadata["units"] for event in credit_events
        )
        amount, amount_label = price.get_amount_and_label(units - credited_units)
        label = f"{meter.name} — {amount_label}"

        return MeteredLineItem(
            price=price,
            start_timestamp=start_timestamp,
            end_timestamp=end_timestamp,
            consumed_units=units,
            credited_units=credited_units,
            amount=amount,
            currency=price.price_currency,
            label=label,
        )


billing_entry = BillingEntryService()
