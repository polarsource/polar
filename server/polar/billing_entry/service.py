import dataclasses
import itertools
import uuid
from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import joinedload

from polar.integrations.stripe.service import stripe as stripe_service
from polar.kit.math import non_negative_running_sum
from polar.meter.service import meter as meter_service
from polar.models import BillingEntry, Event, OrderItem, Subscription
from polar.models.event import EventSource
from polar.postgres import AsyncSession
from polar.product.guard import MeteredPrice, is_metered_price

from .repository import BillingEntryRepository


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


class BillingEntryService:
    async def create_order_items_from_pending(
        self,
        session: AsyncSession,
        subscription: Subscription,
        *,
        stripe_invoice_id: str,
        stripe_customer_id: str,
    ) -> Sequence[OrderItem]:
        repository = BillingEntryRepository.from_session(session)

        items: list[tuple[OrderItem, Sequence[BillingEntry]]] = []
        for line_item, entries in await self.compute_pending_subscription_line_items(
            session, subscription
        ):
            order_item_id = uuid.uuid4()
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
                proration=False,
                product_price=price,
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
    ) -> Sequence[tuple[MeteredLineItem, Sequence[BillingEntry]]]:
        repository = BillingEntryRepository.from_session(session)
        pending_entries = await repository.get_pending_by_subscription(
            subscription.id,
            options=(
                joinedload(BillingEntry.product_price),
                joinedload(BillingEntry.event),
            ),
        )
        entries_by_price = itertools.groupby(
            pending_entries, lambda entry: entry.product_price
        )

        items: list[tuple[MeteredLineItem, list[BillingEntry]]] = []
        for price, entries in entries_by_price:
            if not is_metered_price(price):
                raise NotImplementedError()

            entries_list = list(entries)
            metered_line_item = await self._get_metered_line_item(
                session, price, entries_list
            )
            items.append((metered_line_item, entries_list))

        return items

    async def _get_metered_line_item(
        self,
        session: AsyncSession,
        price: MeteredPrice,
        entries: Sequence[BillingEntry],
    ) -> MeteredLineItem:
        meter_events = [
            entry.event_id
            for entry in entries
            if entry.event.source == EventSource.user
        ]
        credit_events = sorted(
            [entry.event for entry in entries if entry.event.is_meter_credit],
            key=lambda event: event.timestamp,
        )

        meter = price.meter
        units = await meter_service.get_quantity(
            session, meter, select(Event.id).where(Event.id.in_(meter_events))
        )
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
