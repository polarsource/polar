"""Products seed component.

The product *type* is a variant. Seat-based and metered are product types too, so
they live here (rather than as separate top-level options): the `seats` variant
creates a seat-based product plus its seat allocation, and the `metered` variant
creates a usage meter plus a metered product.
"""

from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from polar.customer.schemas.customer import CustomerIndividualCreate
from polar.customer.service import customer as customer_service
from polar.enums import (
    SubscriptionRecurringInterval,
    TaxBehavior,
    TaxBehaviorOption,
)
from polar.kit.currency import PresentmentCurrency
from polar.kit.utils import utc_now
from polar.meter.aggregation import CountAggregation
from polar.meter.filter import Filter, FilterClause, FilterConjunction, FilterOperator
from polar.meter.schemas import MeterCreate
from polar.meter.service import meter as meter_service
from polar.models.customer_seat import CustomerSeat, SeatStatus
from polar.models.product import Product
from polar.models.product_price import ProductPriceAmountType, ProductPriceSeatUnit
from polar.models.subscription import Subscription, SubscriptionStatus
from polar.models.subscription_product_price import SubscriptionProductPrice
from polar.product.schemas import (
    ProductCreateOneTime,
    ProductCreateRecurring,
    ProductPriceFixedCreate,
    ProductPriceMeteredUnitCreate,
    ProductPriceSeatBasedCreate,
    ProductPriceSeatTier,
    ProductPriceSeatTiers,
)
from polar.product.service import product as product_service

from scripts.seeds.base import SeedContext, Variant

RECURRING_PRODUCTS = [
    ("Pro Plan", "Monthly pro subscription", 2900, SubscriptionRecurringInterval.month),
    ("Business Plan", "Monthly business subscription", 9900, SubscriptionRecurringInterval.month),
    ("Enterprise", "Annual enterprise subscription", 99900, SubscriptionRecurringInterval.year),
]
ONE_TIME_PRODUCTS = [
    ("Starter Kit", "One-time starter package", 4900),
    ("Premium Add-on", "One-time premium add-on", 1900),
]
SEAT_PRICE_PER_SEAT = 1000
SEATS_PURCHASED = 5
SEATS_ALLOCATED = 3
METERED_UNIT_AMOUNT = Decimal("0.01")


def _fixed_price(amount: int) -> ProductPriceFixedCreate:
    return ProductPriceFixedCreate(
        amount_type=ProductPriceAmountType.fixed,
        tax_behavior=TaxBehaviorOption.exclusive,
        price_amount=amount,
        price_currency=PresentmentCurrency.usd,
    )


class ProductsComponent:
    key = "products"
    label = "Products"
    default_on = True
    requires: list[str] = []
    variants = [
        Variant("mix", "A mix (subscriptions + one-time)"),
        Variant("subscriptions", "Subscriptions only"),
        Variant("one_time", "One-time only"),
        Variant("seats", "Seat-based (per-seat, with seat allocation)"),
        Variant("metered", "Metered usage (meter + metered product)"),
    ]

    async def build(self, ctx: SeedContext, variant: str | None) -> str:
        variant = variant or "mix"
        products: list[Product] = []

        if variant in ("mix", "subscriptions"):
            products += await self._create_recurring(ctx)
        if variant in ("mix", "one_time"):
            products += await self._create_one_time(ctx)
        if variant == "seats":
            products.append(await self._create_seat_based(ctx))
        if variant == "metered":
            products.append(await self._create_metered(ctx))

        for product in products:
            await ctx.session.refresh(product, ["all_prices"])
        ctx.created["products"] = products

        if variant == "seats":
            seat_price = next(
                p for p in products[-1].all_prices if isinstance(p, ProductPriceSeatUnit)
            )
            allocation = await self._seed_seat_allocation(ctx, products[-1], seat_price)
            return f"1 seat-based product + {allocation}"
        if variant == "metered":
            return "1 meter + 1 metered product"
        return f"{len(products)} products ({variant})"

    async def _create_recurring(self, ctx: SeedContext) -> list[Product]:
        created = []
        for name, description, amount, interval in RECURRING_PRODUCTS:
            created.append(
                await product_service.create(
                    session=ctx.session,
                    create_schema=ProductCreateRecurring(
                        name=name,
                        description=description,
                        organization_id=ctx.organization.id,
                        recurring_interval=interval,
                        prices=[_fixed_price(amount)],
                    ),
                    auth_subject=ctx.auth_subject,
                )
            )
        return created

    async def _create_one_time(self, ctx: SeedContext) -> list[Product]:
        created = []
        for name, description, amount in ONE_TIME_PRODUCTS:
            created.append(
                await product_service.create(
                    session=ctx.session,
                    create_schema=ProductCreateOneTime(
                        name=name,
                        description=description,
                        organization_id=ctx.organization.id,
                        prices=[_fixed_price(amount)],
                    ),
                    auth_subject=ctx.auth_subject,
                )
            )
        return created

    async def _create_seat_based(self, ctx: SeedContext) -> Product:
        return await product_service.create(
            session=ctx.session,
            create_schema=ProductCreateRecurring(
                name="Team Plan",
                description="Per-seat team subscription",
                organization_id=ctx.organization.id,
                recurring_interval=SubscriptionRecurringInterval.month,
                prices=[
                    ProductPriceSeatBasedCreate(
                        amount_type=ProductPriceAmountType.seat_based,
                        price_currency=PresentmentCurrency.usd,
                        tax_behavior=TaxBehaviorOption.exclusive,
                        seat_tiers=ProductPriceSeatTiers(
                            tiers=[
                                ProductPriceSeatTier(
                                    min_seats=1,
                                    max_seats=None,
                                    price_per_seat=SEAT_PRICE_PER_SEAT,
                                )
                            ]
                        ),
                    )
                ],
            ),
            auth_subject=ctx.auth_subject,
        )

    async def _create_metered(self, ctx: SeedContext) -> Product:
        meter = await meter_service.create(
            session=ctx.session,
            meter_create=MeterCreate(
                name="Email Sends",
                filter=Filter(
                    conjunction=FilterConjunction.and_,
                    clauses=[
                        FilterClause(
                            property="type",
                            operator=FilterOperator.eq,
                            value="email_sent",
                        )
                    ],
                ),
                aggregation=CountAggregation(),
                organization_id=ctx.organization.id,
            ),
            auth_subject=ctx.auth_subject,
        )
        return await product_service.create(
            session=ctx.session,
            create_schema=ProductCreateRecurring(
                name="Usage Plan",
                description="Pay per email sent",
                organization_id=ctx.organization.id,
                recurring_interval=SubscriptionRecurringInterval.month,
                prices=[
                    ProductPriceMeteredUnitCreate(
                        amount_type=ProductPriceAmountType.metered_unit,
                        price_currency=PresentmentCurrency.usd,
                        tax_behavior=TaxBehaviorOption.exclusive,
                        unit_amount=METERED_UNIT_AMOUNT,
                        meter_id=meter.id,
                        cap_amount=None,
                    )
                ],
            ),
            auth_subject=ctx.auth_subject,
        )

    async def _seed_seat_allocation(
        self, ctx: SeedContext, seat_product: Product, seat_price: ProductPriceSeatUnit
    ) -> str:
        slug = ctx.organization.slug
        owner = await customer_service.create(
            session=ctx.session,
            customer_create=CustomerIndividualCreate(
                email=f"seats_owner_{slug}@polar.sh",
                name="Seats Owner",
                organization_id=ctx.organization.id,
            ),
            auth_subject=ctx.auth_subject,
        )

        now = utc_now()
        amount = seat_price.calculate_amount(SEATS_PURCHASED)
        subscription = Subscription(
            amount=amount,
            net_amount=amount,
            currency=seat_price.price_currency,
            tax_behavior=TaxBehavior.exclusive,
            recurring_interval=seat_product.recurring_interval,
            recurring_interval_count=1,
            status=SubscriptionStatus.active,
            current_period_start=now,
            current_period_end=now + timedelta(days=30),
            cancel_at_period_end=False,
            started_at=now,
            customer_id=owner.id,
            organization_id=seat_product.organization_id,
            product_id=seat_product.id,
            seats=SEATS_PURCHASED,
            anchor_day=now.day,
        )
        ctx.session.add(subscription)
        await ctx.session.flush()
        ctx.session.add(
            SubscriptionProductPrice(
                subscription_id=subscription.id,
                product_price_id=seat_price.id,
                amount=amount,
            )
        )
        await ctx.session.flush()

        for index in range(SEATS_PURCHASED):
            if index < SEATS_ALLOCATED:
                holder = await customer_service.create(
                    session=ctx.session,
                    customer_create=CustomerIndividualCreate(
                        email=f"seat{index + 1}_{slug}@polar.sh",
                        name=f"Seat Holder {index + 1}",
                        organization_id=ctx.organization.id,
                    ),
                    auth_subject=ctx.auth_subject,
                )
                seat = CustomerSeat(
                    subscription_id=subscription.id,
                    status=SeatStatus.claimed,
                    customer_id=holder.id,
                    email=holder.email,
                    claimed_at=now,
                )
            else:
                seat = CustomerSeat(
                    subscription_id=subscription.id,
                    status=SeatStatus.pending,
                    customer_id=owner.id,
                )
            ctx.session.add(seat)

        await ctx.session.flush()
        return f"{SEATS_PURCHASED} seats ({SEATS_ALLOCATED} claimed)"


component = ProductsComponent()
