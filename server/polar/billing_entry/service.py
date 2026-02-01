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
from polar.models import BillingEntry, Event, OrderItem, Product, Subscription
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


@dataclasses.dataclass
class BillingSegment:
    """A time segment within a billing period for proration calculations."""

    start: datetime
    end: datetime
    product_id: uuid.UUID
    price: MeteredPrice | None  # None if product has no meter for this meter_id


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
            # ALL events in the period, not per-price, AND prorated by time on each plan.
            if not metered_price.meter.aggregation.is_summable():
                if meter_id in processed_meters:
                    continue
                processed_meters.add(meter_id)

                # Get all pending entry IDs for this meter (we'll link them all at once)
                pending_entries_ids = (
                    await repository.get_pending_ids_by_subscription_and_meter(
                        subscription.id, meter_id
                    )
                )

                # Build billing segments based on product changes within the period
                period_start = subscription.current_period_start
                period_end = subscription.current_period_end
                assert period_start is not None
                assert period_end is not None
                total_period_seconds = (period_end - period_start).total_seconds()

                segments = await self._build_billing_segments(
                    session,
                    subscription,
                    meter_id,
                    period_start,
                    period_end,
                    fallback_price=metered_price,  # From the billing entry
                )

                # Compute a line item for each segment that has a valid price
                # Link all billing entries to the first line item only (to avoid duplicates)
                entries_linked = False
                for segment in segments:
                    line_item = await self._compute_segment_line_item(
                        session, segment, subscription, meter_id, total_period_seconds
                    )
                    if line_item is not None:
                        if not entries_linked:
                            yield line_item, pending_entries_ids
                            entries_linked = True
                        else:
                            # Subsequent segments don't link entries (already done)
                            yield line_item, []

                # Skip the common yield at the end - we've already yielded per segment
                continue
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

    async def _build_billing_segments(
        self,
        session: AsyncSession,
        subscription: Subscription,
        meter_id: uuid.UUID,
        period_start: datetime,
        period_end: datetime,
        fallback_price: MeteredPrice | None = None,
    ) -> list[BillingSegment]:
        """
        Build time segments based on product changes within the billing period.

        Each segment represents a contiguous time period where a specific product
        (and thus price) was active. Used for prorating non-summable aggregations.

        Args:
            fallback_price: Price to use if no active price can be determined
                            (e.g., when current product doesn't have this meter)
        """
        event_repository = EventRepository.from_session(session)
        product_repository = ProductRepository.from_session(session)

        # Get all product change events within the billing period
        change_events_statement = (
            event_repository.get_subscription_product_changes_statement(
                subscription.id, period_start, period_end
            )
        )
        change_events = await event_repository.get_all(change_events_statement)

        segments: list[BillingSegment] = []

        if not change_events:
            # No changes in period - single segment with current product
            # Look up the active price from subscription_product_prices (source of truth)
            price: MeteredPrice | None = None
            for spp in subscription.subscription_product_prices:
                if (
                    is_metered_price(spp.product_price)
                    and spp.product_price.meter_id == meter_id
                ):
                    price = spp.product_price
                    break

            # If no active price found (current product doesn't have this meter),
            # fall back to the price from the billing entry
            if price is None:
                price = fallback_price

            return [
                BillingSegment(
                    start=period_start,
                    end=period_end,
                    product_id=subscription.product_id,
                    price=price,
                )
            ]

        # Build segments from change events
        # First segment: from period_start to first change
        first_change = change_events[0]
        old_product_id = uuid.UUID(first_change.user_metadata["old_product_id"])
        old_product = await product_repository.get_by_id(old_product_id)

        if old_product:
            price = self._find_metered_price_for_meter(
                old_product, meter_id, subscription.currency
            )
            segments.append(
                BillingSegment(
                    start=period_start,
                    end=first_change.timestamp,
                    product_id=old_product_id,
                    price=price,
                )
            )

        # Middle segments: between consecutive changes
        for i, change_event in enumerate(change_events):
            new_product_id = uuid.UUID(change_event.user_metadata["new_product_id"])
            new_product = await product_repository.get_by_id(new_product_id)

            if new_product:
                # Segment end is either the next change or period end
                if i + 1 < len(change_events):
                    segment_end = change_events[i + 1].timestamp
                else:
                    segment_end = period_end

                price = self._find_metered_price_for_meter(
                    new_product, meter_id, subscription.currency
                )
                segments.append(
                    BillingSegment(
                        start=change_event.timestamp,
                        end=segment_end,
                        product_id=new_product_id,
                        price=price,
                    )
                )

        return segments

    def _find_metered_price_for_meter(
        self, product: Product, meter_id: uuid.UUID, currency: str
    ) -> MeteredPrice | None:
        """Find the metered price for a specific meter on a product."""
        for price in product.prices:
            if (
                is_metered_price(price)
                and price.meter_id == meter_id
                and price.price_currency == currency
            ):
                return price
        return None

    async def _compute_segment_line_item(
        self,
        session: AsyncSession,
        segment: BillingSegment,
        subscription: Subscription,
        meter_id: uuid.UUID,
        total_period_seconds: float,
    ) -> MeteredLineItem | None:
        """
        Compute a metered line item for a specific billing segment.

        Returns None if the segment has no metered price (product doesn't have this meter)
        or if there are no events in the segment.
        """
        if segment.price is None:
            return None

        event_repository = EventRepository.from_session(session)
        meter = segment.price.meter

        # Get events for this meter within the segment's time bounds
        events_statement = event_repository.get_by_pending_entries_for_meter_statement(
            subscription.id, meter_id
        ).where(
            Event.timestamp >= segment.start,
            Event.timestamp < segment.end,
        )

        units = await meter_service.get_quantity(
            session,
            meter,
            events_statement.where(
                Event.organization_id == meter.organization_id,
                Event.source == EventSource.user,
            ),
        )

        if units == 0:
            return None

        credit_events_statement = events_statement.where(
            Event.is_meter_credit.is_(True)
        )
        credit_events = await event_repository.get_all(credit_events_statement)
        credited_units = non_negative_running_sum(
            event.user_metadata["units"] for event in credit_events
        )

        # Calculate prorated amount
        segment_seconds = (segment.end - segment.start).total_seconds()
        proration_factor = (
            segment_seconds / total_period_seconds if total_period_seconds > 0 else 1.0
        )

        full_amount, amount_label = segment.price.get_amount_and_label(
            units - credited_units
        )
        prorated_amount = round(full_amount * proration_factor)

        label = f"{meter.name} — {amount_label}"

        return MeteredLineItem(
            price=segment.price,
            start_timestamp=segment.start,
            end_timestamp=segment.end,
            consumed_units=units,
            credited_units=credited_units,
            amount=prorated_amount,
            currency=segment.price.price_currency,
            label=label,
        )


billing_entry = BillingEntryService()
