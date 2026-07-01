"""Orders & subscriptions seed component.

Creates real `Subscription` rows (active + trialing, for PG-based metrics) and a
realistic order/cancellation/refund timeline of events (for Tinybird-backed
metrics). Reuses the timeline builder from `seeds_load.py` for now; it will move
into this package as part of the cutover (see MIGRATION.md).
"""

from __future__ import annotations

from datetime import timedelta

from sqlalchemy import select

from polar.enums import TaxBehavior
from polar.event.repository import EventRepository
from polar.kit.utils import utc_now
from polar.models.event import Event as EventModel
from polar.models.product_price import ProductPriceFixed
from polar.models.subscription import Subscription, SubscriptionStatus
from polar.models.subscription_product_price import SubscriptionProductPrice

from scripts.seeds.base import SeedContext, Variant
from scripts.seeds.events import (
    _build_customer_timeline_events,
    _flush_tinybird_events,
    _stamp_event_type_ids,
)
from tests.fixtures.database import save_fixture_factory
from tests.fixtures.random_objects import create_order


class OrdersComponent:
    key = "orders"
    label = "Orders & subscriptions"
    default_on = True
    requires = ["products", "customers"]
    variants: list[Variant] = []

    async def build(self, ctx: SeedContext, variant: str | None) -> str:
        customers = ctx.created.get("customers", [])
        products = ctx.created.get("products", [])
        if not customers or not products:
            return "orders: needs products and customers"

        await self._seed_timeline(ctx, customers, products)
        subscriptions = await self._seed_subscriptions(ctx, customers, products)

        return f"{len(customers)} timelines, {subscriptions} subscriptions + orders"

    async def _seed_timeline(self, ctx: SeedContext, customers: list, products: list) -> None:
        event_repository = EventRepository.from_session(ctx.session)
        pending_events: list[EventModel] = []
        pending_ancestors: dict = {}

        for customer in customers:
            events = _build_customer_timeline_events(
                organization_id=ctx.organization.id,
                customer_id=customer.id,
                customer_email=customer.email,
                customer_name=customer.name or customer.email,
                products=products,
            )
            if not events:
                continue
            await _stamp_event_type_ids(ctx.session, events)
            event_ids, _ = await event_repository.insert_batch(events)
            if event_ids:
                inserted = await event_repository.get_all(
                    select(EventModel).where(EventModel.id.in_(event_ids))
                )
                ancestors = await event_repository.get_ancestors_batch(event_ids)
                pending_events.extend(inserted)
                pending_ancestors.update(ancestors)

        if not ctx.skip_tinybird:
            await _flush_tinybird_events(pending_events, pending_ancestors)

    async def _seed_subscriptions(
        self, ctx: SeedContext, customers: list, products: list
    ) -> int:
        recurring = [p for p in products if p.recurring_interval is not None]
        if not recurring:
            return 0

        save = save_fixture_factory(ctx.session)
        now = utc_now()
        count = 0
        for index, customer in enumerate(customers):
            product = recurring[index % len(recurring)]
            fixed_price = next(
                (p for p in product.all_prices if isinstance(p, ProductPriceFixed)),
                None,
            )
            if fixed_price is None:
                continue

            is_trial = index % 3 == 0
            subscription = Subscription(
                amount=fixed_price.price_amount,
                net_amount=fixed_price.price_amount,
                currency=fixed_price.price_currency,
                tax_behavior=TaxBehavior.exclusive,
                recurring_interval=product.recurring_interval,
                recurring_interval_count=1,
                status=(
                    SubscriptionStatus.trialing if is_trial else SubscriptionStatus.active
                ),
                current_period_start=now,
                current_period_end=now + timedelta(days=30),
                trial_start=now if is_trial else None,
                trial_end=now + timedelta(days=14) if is_trial else None,
                cancel_at_period_end=False,
                started_at=now,
                customer_id=customer.id,
                organization_id=product.organization_id,
                product_id=product.id,
                anchor_day=now.day,
            )
            ctx.session.add(subscription)
            await ctx.session.flush()

            ctx.session.add(
                SubscriptionProductPrice(
                    subscription_id=subscription.id,
                    product_price_id=fixed_price.id,
                    amount=fixed_price.price_amount,
                )
            )
            await ctx.session.flush()

            await create_order(
                save,
                customer=customer,
                product=product,
                subscription=subscription,
                subtotal_amount=fixed_price.price_amount,
            )
            count += 1

        await ctx.session.flush()
        return count


component = OrdersComponent()
