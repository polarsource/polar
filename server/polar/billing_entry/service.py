import itertools
import uuid
from collections.abc import Sequence

from sqlalchemy.orm import joinedload

from polar.integrations.stripe.service import stripe as stripe_service
from polar.meter.service import meter as meter_service
from polar.models import BillingEntry, OrderItem, Subscription
from polar.postgres import AsyncSession
from polar.product.guard import is_metered_price

from .repository import BillingEntryRepository


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
        pending_entries = await repository.get_pending_by_subscription(
            subscription.id,
            options=(joinedload(BillingEntry.product_price),),
        )
        entries_by_price = itertools.groupby(
            pending_entries, lambda entry: entry.product_price
        )

        items: list[tuple[OrderItem, list[BillingEntry]]] = []
        for price, entries in entries_by_price:
            if not is_metered_price(price):
                raise NotImplementedError()

            entries_list = list(entries)

            meter = price.meter
            units = await meter_service.get_quantity(
                session, meter, [entry.event_id for entry in entries_list]
            )
            amount, amount_label = price.get_amount_and_label(units)
            label = f"{meter.name} — {amount_label}"

            order_item_id = uuid.uuid4()
            await stripe_service.create_invoice_item(
                customer=stripe_customer_id,
                invoice=stripe_invoice_id,
                amount=amount,
                currency=price.price_currency,
                description=label,
                metadata={
                    "order_item_id": str(order_item_id),
                    "product_price_id": str(price.id),
                    "meter_id": str(meter.id),
                    "units": str(units),
                    "included_units": str(price.included_units),
                    "unit_amount": str(price.unit_amount),
                    "cap_amount": str(price.cap_amount),
                },
            )

            order_item = OrderItem(
                id=order_item_id,
                label=label,
                amount=amount,
                tax_amount=0,
                proration=False,
                product_price=price,
            )
            items.append((order_item, entries_list))

        # Update entries with order item
        # We don't do it in the main loop to avoid issues with DB flush, since we're
        # generating OrderItem without attached to an Order yet.
        for order_item, order_item_entries in items:
            for entry in order_item_entries:
                await repository.update(entry, update_dict={"order_item": order_item})

        return [item for item, _ in items]


billing_entry = BillingEntryService()
