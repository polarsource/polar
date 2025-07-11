import dataclasses
import itertools
import uuid
from collections.abc import Sequence
from datetime import datetime
from typing import cast

from babel.dates import format_date
from sqlalchemy.orm import joinedload
from sqlalchemy.util.typing import Literal

from polar.event.repository import EventRepository
from polar.integrations.stripe.service import stripe as stripe_service
from polar.kit.math import non_negative_running_sum
from polar.meter.service import meter as meter_service
from polar.models import BillingEntry, Event, OrderItem, Subscription
from polar.models.event import EventSource
from polar.postgres import AsyncSession
from polar.product.guard import (
    MeteredPrice,
    StaticPrice,
    is_metered_price,
    is_static_price,
)
from polar.product.repository import ProductRepository

from .repository import BillingEntryRepository


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
    async def create_order_items_from_pending(
        self,
        session: AsyncSession,
        subscription: Subscription,
        *,
        stripe_invoice_id: str | None = None,
        stripe_customer_id: str | None = None,
    ) -> Sequence[OrderItem]:
        repository = BillingEntryRepository.from_session(session)

        items: list[tuple[OrderItem, Sequence[BillingEntry]]] = []
        for line_item, entries in await self.compute_pending_subscription_line_items(
            session, subscription
        ):
            order_item_id = uuid.uuid4()

            # For legacy subscriptions managed by Stripe, we create invoice items on Stripe
            if stripe_invoice_id and stripe_customer_id:
                assert isinstance(line_item, MeteredLineItem)
                price = line_item.price
                await stripe_service.create_invoice_item(
                    customer=stripe_customer_id,
                    invoice=stripe_invoice_id,
                    amount=line_item.amount,
                    currency=line_item.currency,
                    description=line_item.label,
                    metadata={
                        "order_item_id": str(order_item_id),
                        "product_price_id": str(price.id),
                        "meter_id": str(price.meter_id),
                        "units": str(line_item.consumed_units),
                        "credited_units": str(line_item.credited_units),
                        "unit_amount": str(price.unit_amount),
                        "cap_amount": str(price.cap_amount),
                    },
                )

            order_item = OrderItem(
                id=order_item_id,
                label=line_item.label,
                amount=line_item.amount,
                tax_amount=0,
                proration=line_item.proration,
                product_price=line_item.price,
            )
            items.append((order_item, entries))

        # Update entries with order item
        # We don't do it in the main loop to avoid issues with DB flush, since we're
        # generating OrderItem without attached to an Order yet.
        for order_item, order_item_entries in items:
            for entry in order_item_entries:
                await repository.update(entry, update_dict={"order_item": order_item})

        return [item for item, _ in items]

    async def compute_pending_subscription_line_items(
        self, session: AsyncSession, subscription: Subscription
    ) -> Sequence[tuple[StaticLineItem | MeteredLineItem, Sequence[BillingEntry]]]:
        repository = BillingEntryRepository.from_session(session)
        pending_entries = await repository.get_pending_by_subscription(
            subscription.id,
            options=(joinedload(BillingEntry.product_price),),
        )

        items: list[tuple[StaticLineItem | MeteredLineItem, list[BillingEntry]]] = []

        static_price_entries = (
            e for e in pending_entries if is_static_price(e.product_price)
        )
        for entry in static_price_entries:
            static_price = cast(StaticPrice, entry.product_price)
            static_line_item = await self._get_static_price_line_item(
                session, static_price, entry
            )
            items.append((static_line_item, [entry]))

        metered_entries_by_price = itertools.groupby(
            (e for e in pending_entries if is_metered_price(e.product_price)),
            lambda e: cast(MeteredPrice, e.product_price),
        )
        for metered_price, entries in metered_entries_by_price:
            entries_list = list(entries)
            metered_line_item = await self._get_metered_line_item(
                session, metered_price, subscription, entries_list
            )
            items.append((metered_line_item, entries_list))

        return items

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
        label = f"{product.name} — From {start} to {end}"

        return StaticLineItem(
            price=price,
            amount=entry.amount,
            currency=entry.currency,
            label=label,
            proration=False,  # TODO: Handle proration for static prices
        )

    async def _get_metered_line_item(
        self,
        session: AsyncSession,
        price: MeteredPrice,
        subscription: Subscription,
        entries: Sequence[BillingEntry],
    ) -> MeteredLineItem:
        event_repository = EventRepository.from_session(session)
        events_statement = event_repository.get_by_pending_entries_statement(
            subscription.id, price.id
        )
        meter = price.meter
        units = await meter_service.get_quantity(
            session,
            meter,
            events_statement.with_only_columns(Event.id).where(
                Event.source == EventSource.user
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

        start_timestamp = min(entry.start_timestamp for entry in entries)
        end_timestamp = max(entry.end_timestamp for entry in entries)

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
