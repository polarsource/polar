import contextlib
import dataclasses
import uuid
from collections import defaultdict
from collections.abc import AsyncGenerator, AsyncIterable, Sequence
from datetime import datetime
from decimal import Decimal
from typing import Literal, cast

import logfire
import structlog
from babel.dates import format_date

from polar.billing_interval.service import billing_interval as billing_interval_service
from polar.billing_interval.types import MeterCharge
from polar.event.repository import EventRepository
from polar.event.system import SystemEvent
from polar.exceptions import PolarError
from polar.kit.math import non_negative_running_sum, polar_round
from polar.kit.utils import utc_now
from polar.meter.aggregation import AggregationFunction
from polar.meter.service import meter as meter_service
from polar.models import BillingEntry, Event, Meter, OrderItem, Product, Subscription
from polar.models.billing_entry import BillingEntryDirection, BillingEntryType
from polar.models.event import EventSource
from polar.postgres import AsyncReadSession, AsyncSession
from polar.product.guard import (
    MeteredPrice,
    StaticPrice,
    is_metered_price,
    is_unit_price,
)
from polar.product.repository import ProductPriceRepository, ProductRepository
from polar.reducer.service import reducer as reducer_service

from .comparison import Comparison, Quantities, compare
from .repository import BillingEntryRepository
from .types import BillingEntrySelector, PendingByMeter, PendingByPrice

log = structlog.get_logger(__name__)


@dataclasses.dataclass
class StaticLineItem:
    price: StaticPrice
    start_timestamp: datetime
    end_timestamp: datetime
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


class ReducerUsageAlreadyBilled(PolarError):
    def __init__(self, subscription: Subscription) -> None:
        self.subscription = subscription
        super().__init__(
            f"Reducer usage of subscription {subscription.id} was billed by "
            "another order while its order was created.",
            409,
        )


async def _no_line_items() -> AsyncGenerator[
    tuple[StaticLineItem | MeteredLineItem, BillingEntrySelector]
]:
    return
    yield


class BillingEntryService:
    @contextlib.asynccontextmanager
    async def _create_order_items(
        self,
        session: AsyncSession,
        subscription: Subscription,
        line_items: AsyncIterable[
            tuple[StaticLineItem | MeteredLineItem, BillingEntrySelector]
        ],
        *,
        cutoff: datetime,
        reducer_cutoff: datetime,
    ) -> AsyncGenerator[Sequence[OrderItem]]:
        repository = BillingEntryRepository.from_session(session)
        await repository.lock_pending_by_subscription(subscription.id)

        item_entries_map: dict[OrderItem, BillingEntrySelector] = {}
        consumed_units: dict[uuid.UUID, Decimal] = defaultdict(Decimal)
        credited_units: dict[uuid.UUID, Decimal] = defaultdict(Decimal)
        net_units: dict[uuid.UUID, Decimal] = defaultdict(Decimal)
        meters: dict[uuid.UUID, Meter] = {}
        meter_order_item_ids: dict[uuid.UUID, list[uuid.UUID]] = defaultdict(list)
        async for line_item, selector in line_items:
            order_item_id = uuid.uuid4()
            if (
                isinstance(line_item, MeteredLineItem)
                and line_item.price.meter.aggregation.func != AggregationFunction.unique
            ):
                meter_id = line_item.price.meter_id
                units = Decimal(str(line_item.consumed_units))
                consumed_units[meter_id] += units
                credited_units[meter_id] += line_item.credited_units
                # Each line item bills its own net units.
                net_units[meter_id] += max(Decimal(0), units - line_item.credited_units)
                meters[meter_id] = line_item.price.meter
                meter_order_item_ids[meter_id].append(order_item_id)
            order_item = OrderItem(
                id=order_item_id,
                label=line_item.label,
                amount=line_item.amount,
                net_amount=line_item.amount,
                tax_amount=0,
                proration=line_item.proration,
                start_timestamp=line_item.start_timestamp,
                end_timestamp=line_item.end_timestamp,
                product_price=line_item.price,
            )
            item_entries_map[order_item] = selector

        yield list(item_entries_map.keys())

        for order_item, selector in item_entries_map.items():
            if isinstance(selector, PendingByPrice):
                await repository.link_pending_by_subscription_and_price(
                    subscription.id,
                    selector.product_price_id,
                    order_item.id,
                    cutoff=cutoff,
                )
            elif isinstance(selector, PendingByMeter):
                await repository.link_pending_by_subscription_and_meter(
                    subscription.id,
                    selector.meter_id,
                    order_item.id,
                    cutoff=cutoff,
                )
            else:
                await repository.update_order_item_id(selector, order_item.id)

        if consumed_units:
            order_id = next(iter(item_entries_map)).order_id
            with logfire.span(
                "Bill and compare reducer usage",
                organization_id=str(subscription.customer.organization_id),
                subscription_id=str(subscription.id),
                order_id=str(order_id),
                cutoff=reducer_cutoff,
            ) as span:
                quantities = await billing_interval_service.bill_usage(
                    session,
                    subscription,
                    set(consumed_units),
                    order_id=order_id,
                    cutoff=reducer_cutoff,
                )
                legacy = {
                    meter_id: Quantities(
                        usage=consumed_units[meter_id],
                        credits=credited_units[meter_id],
                        net=net,
                    )
                    for meter_id, net in net_units.items()
                }
                comparisons: dict[uuid.UUID, Comparison] = {}
                for meter_id, (usage, credits) in quantities.items():
                    comparisons[meter_id] = await compare(
                        session,
                        subscription,
                        meters[meter_id],
                        order_id,
                        meter_order_item_ids[meter_id],
                        legacy=legacy[meter_id],
                        reducer=Quantities(
                            usage=usage,
                            credits=credits,
                            net=max(Decimal(0), usage - credits),
                        ),
                        cutoff=reducer_cutoff,
                    )
                span.set_attribute(
                    "quantities",
                    {
                        str(meter_id): comparisons[meter_id].to_dict()
                        if meter_id in comparisons
                        else {"legacy": legacy[meter_id].to_dict(), "reducer": None}
                        for meter_id in legacy
                    },
                )
                span.set_attribute(
                    "raw_match",
                    all(
                        meter_id in comparisons and comparisons[meter_id].raw_match
                        for meter_id in legacy
                    ),
                )
                span.set_attribute(
                    "match",
                    all(
                        meter_id in comparisons and comparisons[meter_id].match
                        for meter_id in legacy
                    ),
                )

    @contextlib.asynccontextmanager
    async def _create_order_items_from_reducers(
        self,
        session: AsyncSession,
        subscription: Subscription,
        static_line_items: AsyncIterable[
            tuple[StaticLineItem | MeteredLineItem, BillingEntrySelector]
        ],
        *,
        include_metered: bool = True,
        period_start: datetime | None,
        cutoff: datetime,
        reducer_cutoff: datetime,
        paid_on_creation: bool = False,
    ) -> AsyncGenerator[Sequence[OrderItem]]:
        """Like `_create_order_items`, with the metered usage read from the
        reducers instead of the pending billing entries. The order bills the
        period from `period_start` to `reducer_cutoff`.

        The order bills exactly the buckets it read: usage arriving while it is
        created is left to the next order. Buckets another order billed in the
        meantime roll the order back to be retried, unless it is
        `paid_on_creation`: it is charged before they are marked and the payment
        can't be rolled back, so it is logged instead."""
        meter_ids = (
            await billing_interval_service.get_meter_ids(session, subscription)
            if include_metered
            else set()
        )

        async with self._create_order_items(
            session,
            subscription,
            static_line_items,
            cutoff=cutoff,
            reducer_cutoff=reducer_cutoff,
        ) as static_items:
            usage, bucket_ids = (
                await billing_interval_service.seal_usage(
                    session,
                    subscription,
                    meter_ids,
                    period_start=period_start,
                    cutoff=reducer_cutoff,
                )
                if meter_ids
                else ({}, [])
            )
            metered_items = [
                item
                for charge in usage.values()
                for item in await self._get_reducer_order_items(session, charge)
            ]

            yield [*static_items, *metered_items]

            if metered_items:
                billed = await reducer_service.mark_as_billed(
                    session, bucket_ids, order_id=metered_items[0].order_id
                )
                if billed != len(bucket_ids):
                    if not paid_on_creation:
                        raise ReducerUsageAlreadyBilled(subscription)
                    log.error(
                        "Reducer usage was billed by another order after the order "
                        "was paid",
                        subscription_id=subscription.id,
                        order_id=metered_items[0].order_id,
                    )

    async def _get_reducer_order_items(
        self, session: AsyncSession, charge: MeterCharge
    ) -> list[OrderItem]:
        return [
            OrderItem(
                label=f"{price.meter.name} — {amount_label}",
                amount=amount,
                net_amount=amount,
                tax_amount=0,
                proration=False,
                product_price=price,
            )
            for price, amount, amount_label in await self._price_reducer_charge(
                session, charge
            )
        ]

    async def get_reducer_charge_amount(
        self, session: AsyncReadSession, charge: MeterCharge
    ) -> int:
        """The amount an order would charge for the meter's usage."""
        return sum(
            amount for _, amount, _ in await self._price_reducer_charge(session, charge)
        )

    async def _price_reducer_charge(
        self, session: AsyncReadSession, charge: MeterCharge
    ) -> list[tuple[MeteredPrice, int, str]]:
        """The amount and label of each price the meter's usage is charged at.
        Credits come off a sum or count at the oldest price first. A max, min or
        average is charged above the credits at every price, for its share of the
        period."""
        repository = ProductPriceRepository.from_session(session)
        priced: list[tuple[MeteredPrice, int, str]] = []
        credited_units = charge.credited_units
        for price_id, units in charge.units_by_price.items():
            if units <= 0:
                continue
            price = cast(
                MeteredPrice, await repository.get_by_id(price_id, include_deleted=True)
            )
            amount, amount_label = price.get_amount_and_label(
                float(units), credited_units
            )
            period_share = charge.period_shares[price_id]
            if period_share < 1:
                amount = polar_round(amount * period_share)
                amount_label += f" — {period_share:.0%} of the period"
            priced.append((price, amount, amount_label))
            if price.meter.aggregation.is_summable():
                credited_units = max(Decimal(0), credited_units - units)
        return priced

    def create_order_items_from_pending(
        self,
        session: AsyncSession,
        subscription: Subscription,
        *,
        include_metered: bool = True,
        cutoff: datetime | None = None,
        reducer_cutoff: datetime | None = None,
        period_start: datetime | None = None,
        paid_on_creation: bool = False,
    ) -> contextlib.AbstractAsyncContextManager[Sequence[OrderItem]]:
        cutoff = cutoff or utc_now()
        if subscription.organization.is_reducer_billing_enabled:
            return self._create_order_items_from_reducers(
                session,
                subscription,
                self.compute_pending_subscription_line_items(
                    session, subscription, include_metered=False, cutoff=cutoff
                ),
                include_metered=include_metered,
                period_start=period_start,
                cutoff=cutoff,
                reducer_cutoff=reducer_cutoff or cutoff,
                paid_on_creation=paid_on_creation,
            )
        return self._create_order_items(
            session,
            subscription,
            self.compute_pending_subscription_line_items(
                session, subscription, include_metered=include_metered, cutoff=cutoff
            ),
            cutoff=cutoff,
            reducer_cutoff=reducer_cutoff or cutoff,
        )

    def create_metered_order_items_from_pending(
        self,
        session: AsyncSession,
        subscription: Subscription,
        *,
        cutoff: datetime | None = None,
        price_ids: Sequence[uuid.UUID] | None = None,
        period_start: datetime | None = None,
    ) -> contextlib.AbstractAsyncContextManager[Sequence[OrderItem]]:
        """
        Build order items from the subscription's pending *metered* billing entries
        only, leaving static/proration entries pending. Used by the meter cycle,
        which settles usage between billing renewals.
        """
        cutoff = cutoff or utc_now()
        if subscription.organization.is_reducer_billing_enabled:
            return self._create_order_items_from_reducers(
                session,
                subscription,
                _no_line_items(),
                period_start=period_start,
                cutoff=cutoff,
                reducer_cutoff=cutoff,
            )
        return self._create_order_items(
            session,
            subscription,
            self.compute_pending_metered_line_items(
                session, subscription, cutoff=cutoff, price_ids=price_ids
            ),
            cutoff=cutoff,
            reducer_cutoff=cutoff,
        )

    async def compute_pending_subscription_line_items(
        self,
        session: AsyncSession,
        subscription: Subscription,
        *,
        include_metered: bool = True,
        cutoff: datetime | None = None,
    ) -> AsyncGenerator[tuple[StaticLineItem | MeteredLineItem, BillingEntrySelector]]:
        cutoff = cutoff or utc_now()
        repository = BillingEntryRepository.from_session(session)

        products: dict[uuid.UUID, Product] = {}
        async for entry in repository.get_static_pending_by_subscription(
            subscription.id, cutoff=cutoff
        ):
            static_price = cast(StaticPrice, entry.product_price)
            static_line_item = await self._get_static_price_line_item(
                session,
                static_price,
                entry,
                seats=subscription.seats,
                units=subscription.units,
                products=products,
            )
            yield static_line_item, [entry.id]

        if not include_metered:
            # Metered usage and its credits belong to the whole billing period.
            # Settling them mid-period consumes the period's credit early, so the
            # entries stay pending and are billed on the next cycle.
            return

        async for (
            metered_line_item,
            selector,
        ) in self.compute_pending_metered_line_items(
            session, subscription, cutoff=cutoff
        ):
            yield metered_line_item, selector

    async def compute_pending_metered_line_items(
        self,
        session: AsyncSession,
        subscription: Subscription,
        *,
        cutoff: datetime | None = None,
        price_ids: Sequence[uuid.UUID] | None = None,
    ) -> AsyncGenerator[tuple[MeteredLineItem, BillingEntrySelector]]:
        cutoff = cutoff or utc_now()
        repository = BillingEntryRepository.from_session(session)

        # 👋 Reading the code below, you might wonder:
        # "Why is this so complex?"
        # "Why are there so many queries?"
        # Well, if you look at the previous implementation, it was much more readable
        # but it involved to load lot of BillingEntry in memory, which was causing
        # performance issues and even OOM on large subscriptions.
        product_price_repository = ProductPriceRepository.from_session(session)

        # ``price_ids`` overrides the subscription's current prices, so a deferred
        # settlement bills against the prices active when it was triggered.
        if price_ids is None:
            active_prices = [
                spp.product_price for spp in subscription.subscription_product_prices
            ]
        else:
            active_prices = [
                price
                for price_id in price_ids
                if (
                    price := await product_price_repository.get_by_id(
                        price_id, include_deleted=True
                    )
                )
                is not None
            ]

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
        ) in repository.get_pending_metered_by_subscription_tuples(
            subscription.id, cutoff=cutoff
        ):
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
                for price in active_prices:
                    if is_metered_price(price) and price.meter_id == meter_id:
                        active_price = price
                        break

                if active_price is None:
                    log.info(
                        f"No active price found for meter {meter_id} in subscription {subscription.id}"
                    )
                    continue

                metered_line_item = await self._get_metered_line_item_by_meter(
                    session,
                    active_price,
                    subscription,
                    start_timestamp,
                    end_timestamp,
                    cutoff=cutoff,
                )
                selector: BillingEntrySelector = PendingByMeter(meter_id)
            else:
                metered_line_item = await self._get_metered_line_item(
                    session,
                    metered_price,
                    subscription,
                    start_timestamp,
                    end_timestamp,
                    cutoff=cutoff,
                )
                selector = PendingByPrice(product_price_id)

            yield metered_line_item, selector

    async def _get_static_price_line_item(
        self,
        session: AsyncSession,
        price: StaticPrice,
        entry: BillingEntry,
        *,
        seats: int | None,
        units: int | None = None,
        products: dict[uuid.UUID, Product],
    ) -> StaticLineItem:
        assert entry.amount is not None
        assert entry.currency is not None

        product = products.get(price.product_id)
        if product is None:
            product_repository = ProductRepository.from_session(session)
            product = await product_repository.get_by_id(price.product_id)
            assert product is not None
            products[price.product_id] = product

        start = format_date(entry.start_timestamp.date(), locale="en_US")
        end = format_date(entry.end_timestamp.date(), locale="en_US")
        amount = entry.amount

        is_seat_change = entry.type in (
            BillingEntryType.subscription_seats_increase,
            BillingEntryType.subscription_seats_decrease,
        )
        is_unit_change = entry.type in (
            BillingEntryType.subscription_units_increase,
            BillingEntryType.subscription_units_decrease,
        )

        if is_seat_change:
            old_seats = entry.event.user_metadata.get("old_seats")
            new_seats = entry.event.user_metadata.get("new_seats")

            if old_seats is not None and new_seats is not None:
                seat_transition = f"{old_seats} → {new_seats} seats"
                price_label = f"{product.name} ({seat_transition})"
            else:
                # This shouldn't happen, but if it does, don't include the full
                # seat count if we can't show a delta to avoid confusion
                price_label = OrderItem.format_price_label(product, price, seats=None)
        elif is_unit_change:
            old_units = entry.event.user_metadata.get("old_units")
            new_units = entry.event.user_metadata.get("new_units")

            if old_units is not None and new_units is not None:
                assert is_unit_price(price)
                unit_transition = (
                    f"{old_units} {price.get_unit_noun(old_units)} → "
                    f"{new_units} {price.get_unit_noun(new_units)}"
                )
                price_label = f"{product.name} ({unit_transition})"
            else:
                price_label = OrderItem.format_price_label(
                    product, price, seats=None, units=None
                )
        else:
            price_label = OrderItem.format_price_label(
                product, price, seats=seats, units=units
            )

        match entry.direction:
            case BillingEntryDirection.credit:
                label = f"Remaining time on {price_label} — From {start} to {end}"
                amount = -amount
            case BillingEntryDirection.debit:
                label = f"{price_label} — From {start} to {end}"

        return StaticLineItem(
            price=price,
            start_timestamp=entry.start_timestamp,
            end_timestamp=entry.end_timestamp,
            amount=amount,
            currency=entry.currency,
            label=label,
            proration=entry.type
            in (
                BillingEntryType.proration,
                BillingEntryType.subscription_seats_increase,
                BillingEntryType.subscription_seats_decrease,
                BillingEntryType.subscription_units_increase,
                BillingEntryType.subscription_units_decrease,
            ),
        )

    async def _get_metered_line_item(
        self,
        session: AsyncSession,
        price: MeteredPrice,
        subscription: Subscription,
        start_timestamp: datetime,
        end_timestamp: datetime,
        *,
        cutoff: datetime,
    ) -> MeteredLineItem:
        """
        Compute a metered line item for a specific price.
        Used for summable aggregations (sum, count) where we can group by price.
        """
        event_repository = EventRepository.from_session(session)
        events_statement = event_repository.get_by_pending_entries_statement(
            subscription.id, price.id, cutoff=cutoff
        )
        meter = price.meter
        if meter.aggregation.func == AggregationFunction.cnt:
            # A count meter's quantity is the number of consumption events, and there
            # is exactly one billing entry per event. Counting the entries directly
            # (total minus the few system-event entries) avoids fanning the pending
            # scan out into a per-event lookup on `events`, which times out for
            # high-volume subscriptions.
            total_units = await event_repository.count_pending_entries(
                subscription.id, price.id, cutoff=cutoff
            )
            system_units = await event_repository.count_pending_system_entries(
                subscription.id,
                price.id,
                organization_id=meter.organization_id,
                customer_id=subscription.customer_id,
                cutoff=cutoff,
            )
            units: float = total_units - system_units
        else:
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
            # Filter on organization_id + customer_id and unpack `is_meter_credit`
            # so we hit the ix_events_org_source_name_customer_id_ingested_at index.
            Event.organization_id == meter.organization_id,
            Event.customer_id == subscription.customer_id,
            Event.source == EventSource.system,
            Event.name == SystemEvent.meter_credited,
        )
        credit_events = await event_repository.get_all(credit_events_statement)
        credited_units = non_negative_running_sum(
            event.user_metadata["units"] for event in credit_events
        )
        amount, amount_label = price.get_amount_and_label(units, credited_units)
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
        *,
        cutoff: datetime,
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
            subscription.id, meter.id, cutoff=cutoff
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
            # Filter on organization_id + customer_id and unpack `is_meter_credit`
            # so we hit the ix_events_org_source_name_customer_id_ingested_at index.
            Event.organization_id == meter.organization_id,
            Event.customer_id == subscription.customer_id,
            Event.source == EventSource.system,
            Event.name == SystemEvent.meter_credited,
        )
        credit_events = await event_repository.get_all(credit_events_statement)
        credited_units = non_negative_running_sum(
            event.user_metadata["units"] for event in credit_events
        )
        amount, amount_label = price.get_amount_and_label(units, credited_units)
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
