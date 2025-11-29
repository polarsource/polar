"""
Full seed data with comprehensive analytics.

Creates a complete organization with:
- Multiple customers with varied behavior
- Subscriptions with history (active, canceled, pending cancellation)
- Orders (subscriptions and one-time purchases)
- Discounts applied to various orders
- Checkouts with different statuses (for conversion rate)
- Customer wallets with balances
- Events for analytics tracking
"""

import random
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any, cast

from polar.auth.models import AuthSubject
from polar.enums import SubscriptionRecurringInterval
from polar.models.checkout import Checkout, CheckoutStatus
from polar.models.checkout_product import CheckoutProduct
from polar.models.customer import Customer
from polar.models.discount import (
    Discount,
    DiscountDuration,
    DiscountFixed,
    DiscountPercentage,
)
from polar.models.order import Order, OrderBillingReasonInternal, OrderStatus
from polar.models.order_item import OrderItem
from polar.models.organization import Organization
from polar.models.product import Product
from polar.models.product_price import ProductPriceFixed
from polar.models.subscription import (
    CustomerCancellationReason,
    Subscription,
    SubscriptionStatus,
)
from polar.models.subscription_product_price import SubscriptionProductPrice
from polar.models.wallet import Wallet, WalletType
from polar.models.wallet_transaction import WalletTransaction
from polar.postgres import AsyncSession

FIRST_NAMES = [
    "Birk",
    "Emil",
    "François",
    "Isac",
    "Ishita",
    "Jesper",
    "Petru",
    "Pieter",
    "Rishi",
    "Sebastian",
]

LAST_NAMES = [
    "Jernström",
    "Widlund",
    "Voron",
    "Lidén",
    "Jariwala",
    "Bränn",
    "Rares Sincraian",
    "Beulque",
    "Ekström",
]

CANCELLATION_REASONS = [
    CustomerCancellationReason.too_expensive,
    CustomerCancellationReason.unused,
    CustomerCancellationReason.missing_features,
    CustomerCancellationReason.switched_service,
    CustomerCancellationReason.low_quality,
    CustomerCancellationReason.too_complex,
    CustomerCancellationReason.customer_service,
    CustomerCancellationReason.other,
]

TAX_RATE = 0.08


@dataclass
class SeedStats:
    """Track statistics during seed creation."""

    customers: int = 0
    subscriptions: int = 0
    orders: int = 0
    today_orders: int = 0
    discounted_orders: int = 0
    checkouts: int = 0
    today_checkouts: int = 0
    wallets: int = 0

    def print_summary(self) -> None:
        print(f"  ✓ Created {self.customers} customers")
        print(f"  ✓ Created {self.subscriptions} subscriptions")
        print(f"  ✓ Created {self.orders} orders ({self.today_orders} from today)")
        print(f"  ✓ {self.discounted_orders} orders with discounts applied")
        print(
            f"  ✓ Created {self.checkouts} checkouts ({self.today_checkouts} from today)"
        )
        print(f"  ✓ Created {self.wallets} customer wallets with balance")


def _create_order(
    *,
    created_at: datetime,
    customer: Customer,
    product: Product,
    price: ProductPriceFixed,
    billing_reason: OrderBillingReasonInternal,
    discount: Discount | None = None,
    subscription: Subscription | None = None,
) -> Order:
    discount_amt = discount.get_discount_amount(price.price_amount) if discount else 0
    tax_amount = int((price.price_amount - discount_amt) * TAX_RATE)

    return Order(
        created_at=created_at,
        status=OrderStatus.paid,
        subtotal_amount=price.price_amount,
        tax_amount=tax_amount,
        discount_amount=discount_amt,
        currency="usd",
        billing_reason=billing_reason,
        stripe_invoice_id=f"in_demo_{uuid.uuid4().hex[:14]}",
        invoice_number=f"INV-DEMO-{uuid.uuid4().hex[:8].upper()}",
        customer=customer,
        product=product,
        subscription=subscription,
        discount=discount,
        items=[
            OrderItem(
                label=product.name,
                amount=price.price_amount,
                tax_amount=tax_amount,
                proration=False,
                product_price_id=price.id,
            )
        ],
    )


async def _create_discounts(
    session: AsyncSession,
    organization: Organization,
) -> list[Discount]:
    discounts: list[Discount] = [
        DiscountPercentage(
            name="20% Off",
            code="SAVE20",
            basis_points=2000,
            duration=DiscountDuration.once,
            organization_id=organization.id,
            stripe_coupon_id=f"coupon_demo_{uuid.uuid4().hex[:14]}",
        ),
        DiscountPercentage(
            name="Half Off Sale",
            code="HALFOFF",
            basis_points=5000,
            duration=DiscountDuration.once,
            organization_id=organization.id,
            stripe_coupon_id=f"coupon_demo_{uuid.uuid4().hex[:14]}",
        ),
        DiscountFixed(
            name="$10 Off",
            code="SAVE10",
            amount=1000,
            currency="usd",
            duration=DiscountDuration.once,
            organization_id=organization.id,
            stripe_coupon_id=f"coupon_demo_{uuid.uuid4().hex[:14]}",
        ),
        DiscountPercentage(
            name="Loyalty Discount",
            code="LOYAL10",
            basis_points=1000,
            duration=DiscountDuration.forever,
            organization_id=organization.id,
            stripe_coupon_id=f"coupon_demo_{uuid.uuid4().hex[:14]}",
        ),
    ]

    for discount in discounts:
        session.add(discount)

    await session.flush()
    print(f"  ✓ Created {len(discounts)} discounts")
    return discounts


async def _create_customers(
    session: AsyncSession,
    organization: Organization,
    count: int = 50,
) -> list[Customer]:
    customers: list[Customer] = []

    for i in range(count):
        first_name = random.choice(FIRST_NAMES)
        last_name = random.choice(LAST_NAMES)

        customer = Customer(
            email=f"{first_name.lower()}.{last_name.lower()}{i}@polar.com",
            email_verified=random.random() < 0.75,
            name=f"{first_name} {last_name}",
            stripe_customer_id=f"cus_demo_{uuid.uuid4().hex[:14]}",
            organization=organization,
        )
        session.add(customer)
        customers.append(customer)

    await session.flush()
    return customers


def _get_period_days(interval: SubscriptionRecurringInterval) -> int:
    """Get the number of days in a billing period."""
    if interval == SubscriptionRecurringInterval.year:
        return 365
    elif interval == SubscriptionRecurringInterval.month:
        return 30
    return 7


async def _create_subscriptions(
    session: AsyncSession,
    customers: list[Customer],
    products: list[Product],
    discounts: list[Discount],
    now: datetime,
    stats: SeedStats,
) -> None:
    for customer in customers:
        if random.random() >= 0.7 or not products:
            continue

        product = random.choice(products)
        if not product.prices:
            continue
        price = cast(ProductPriceFixed, product.prices[0])

        days_ago = random.randint(1, 90)
        started_at = now - timedelta(days=days_ago)

        status, canceled_at, ended_at, ends_at, cancel_at_period_end = (
            _get_subscription_status(now)
        )

        cancellation_reason = None
        if status == SubscriptionStatus.canceled or cancel_at_period_end:
            cancellation_reason = random.choice(CANCELLATION_REASONS)

        recurring_interval = (
            product.recurring_interval or SubscriptionRecurringInterval.month
        )
        period_days = _get_period_days(recurring_interval)
        periods_elapsed = days_ago // period_days
        current_period_start = started_at + timedelta(
            days=periods_elapsed * period_days
        )
        current_period_end = current_period_start + timedelta(days=period_days)

        subscription_discount = (
            random.choice(discounts) if random.random() < 0.2 else None
        )

        subscription = Subscription(
            stripe_subscription_id=f"sub_demo_{uuid.uuid4().hex[:14]}",
            recurring_interval=recurring_interval,
            recurring_interval_count=1,
            amount=price.price_amount,
            currency="usd",
            status=status,
            tax_exempted=False,
            current_period_start=current_period_start,
            current_period_end=current_period_end,
            cancel_at_period_end=cancel_at_period_end,
            canceled_at=canceled_at,
            started_at=started_at,
            ended_at=ended_at,
            ends_at=ends_at,
            customer=customer,
            product=product,
            discount=subscription_discount,
            customer_cancellation_reason=cancellation_reason,
            subscription_product_prices=[SubscriptionProductPrice.from_price(price)],
        )
        session.add(subscription)
        await session.flush()
        stats.subscriptions += 1

        if subscription_discount:
            stats.discounted_orders += 1

        initial_order = _create_order(
            created_at=started_at,
            customer=customer,
            product=product,
            price=price,
            billing_reason=OrderBillingReasonInternal.subscription_create,
            discount=subscription_discount,
            subscription=subscription,
        )
        session.add(initial_order)
        stats.orders += 1

        for period in range(1, periods_elapsed + 1):
            renewal_date = started_at + timedelta(days=period * period_days)
            if renewal_date < now and status != SubscriptionStatus.canceled:
                renewal_discount = (
                    subscription_discount
                    if subscription_discount
                    and subscription_discount.duration == DiscountDuration.forever
                    else None
                )
                renewal_order = _create_order(
                    created_at=renewal_date,
                    customer=customer,
                    product=product,
                    price=price,
                    billing_reason=OrderBillingReasonInternal.subscription_cycle,
                    discount=renewal_discount,
                    subscription=subscription,
                )
                session.add(renewal_order)
                stats.orders += 1


def _get_subscription_status(
    now: datetime,
) -> tuple[SubscriptionStatus, datetime | None, datetime | None, datetime | None, bool]:
    roll = random.random()

    if roll < 0.7:
        return SubscriptionStatus.active, None, None, None, False
    elif roll < 0.85:
        canceled_at = now - timedelta(days=random.randint(1, 10))
        return SubscriptionStatus.active, canceled_at, None, None, True
    else:
        canceled_at = now - timedelta(days=random.randint(1, 30))
        return SubscriptionStatus.canceled, canceled_at, canceled_at, canceled_at, False


async def _create_onetime_orders(
    session: AsyncSession,
    customers: list[Customer],
    products: list[Product],
    discounts: list[Discount],
    now: datetime,
    stats: SeedStats,
) -> None:
    for customer in customers:
        if random.random() >= 0.4 or not products:
            continue

        for _ in range(random.randint(1, 3)):
            product = random.choice(products)
            if not product.prices:
                continue
            price = cast(ProductPriceFixed, product.prices[0])

            if random.random() < 0.3:
                purchase_date = now - timedelta(
                    hours=random.randint(0, 12),
                    minutes=random.randint(0, 59),
                )
            else:
                purchase_date = now - timedelta(
                    days=random.randint(1, 60),
                    hours=random.randint(0, 23),
                    minutes=random.randint(0, 59),
                )

            order_discount = (
                random.choice(discounts) if random.random() < 0.15 else None
            )
            if order_discount:
                stats.discounted_orders += 1

            order = _create_order(
                created_at=purchase_date,
                customer=customer,
                product=product,
                price=price,
                billing_reason=OrderBillingReasonInternal.purchase,
                discount=order_discount,
            )
            session.add(order)
            stats.orders += 1


async def _create_today_orders(
    session: AsyncSession,
    customers: list[Customer],
    products: list[Product],
    now: datetime,
    stats: SeedStats,
    count: int = 10,
) -> None:
    for _ in range(count):
        customer = random.choice(customers)
        product = random.choice(products)
        if not product.prices:
            continue
        price = cast(ProductPriceFixed, product.prices[0])

        purchase_date = now - timedelta(
            hours=random.randint(0, 8),
            minutes=random.randint(0, 59),
        )

        billing_reason = (
            OrderBillingReasonInternal.purchase
            if product.recurring_interval is None
            else OrderBillingReasonInternal.subscription_create
        )

        order = _create_order(
            created_at=purchase_date,
            customer=customer,
            product=product,
            price=price,
            billing_reason=billing_reason,
        )
        session.add(order)
        stats.orders += 1
        stats.today_orders += 1


async def _create_checkouts(
    session: AsyncSession,
    organization: Organization,
    customers: list[Customer],
    products: list[Product],
    now: datetime,
    stats: SeedStats,
    count: int = 100,
    today_count: int = 20,
) -> None:
    for i in range(count):
        product = random.choice(products)
        if not product.prices:
            continue
        price = cast(ProductPriceFixed, product.prices[0])

        checkout_status, checkout_customer = _get_checkout_status(customers)

        if i < today_count:
            checkout_created = now - timedelta(
                hours=random.randint(0, 12),
                minutes=random.randint(0, 59),
            )
            stats.today_checkouts += 1
        else:
            checkout_created = now - timedelta(
                days=random.randint(1, 30),
                hours=random.randint(0, 23),
                minutes=random.randint(0, 59),
            )

        checkout = Checkout(
            created_at=checkout_created,
            status=checkout_status,
            client_secret=f"cs_demo_{uuid.uuid4().hex}",
            expires_at=checkout_created + timedelta(hours=24),
            amount=price.price_amount,
            currency="usd",
            organization_id=organization.id,
            product_id=product.id,
            product_price_id=price.id,
            customer=checkout_customer,
            customer_email=(
                checkout_customer.email
                if checkout_customer
                else f"visitor{random.randint(1, 1000)}@example.com"
            ),
        )
        session.add(checkout)

        checkout_product = CheckoutProduct(checkout=checkout, product=product, order=0)
        session.add(checkout_product)
        stats.checkouts += 1


def _get_checkout_status(
    customers: list[Customer],
) -> tuple[CheckoutStatus, Customer | None]:
    roll = random.random()

    if roll < 0.50:
        return CheckoutStatus.succeeded, random.choice(customers)
    elif roll < 0.80:
        status = random.choice([CheckoutStatus.open, CheckoutStatus.expired])
        customer = random.choice(customers) if random.random() < 0.5 else None
        return status, customer
    else:
        return CheckoutStatus.failed, random.choice(customers)


async def _create_wallets(
    session: AsyncSession,
    customers: list[Customer],
    now: datetime,
    stats: SeedStats,
    count: int = 20,
) -> None:
    selected = random.sample(customers, min(count, len(customers)))

    for customer in selected:
        wallet = Wallet(
            type=WalletType.billing,
            currency="usd",
            customer=customer,
        )
        session.add(wallet)
        await session.flush()

        for _ in range(random.randint(1, 5)):
            transaction = WalletTransaction(
                timestamp=now
                - timedelta(days=random.randint(1, 60), hours=random.randint(0, 23)),
                currency="usd",
                amount=random.randint(1000, 20000),
                wallet_id=wallet.id,
            )
            session.add(transaction)

        stats.wallets += 1


async def create_full_seed_analytics(
    session: AsyncSession,
    organization: Organization,
    products: list[Product],
    auth_subject: AuthSubject[Any],
) -> None:
    """Create comprehensive analytics data for an organization.

    This creates a full set of seed data including customers, subscriptions,
    orders, discounts, checkouts, and wallet balances.
    """
    now = datetime.now(UTC)
    stats = SeedStats()

    subscription_products = [p for p in products if p.recurring_interval is not None]
    onetime_products = [p for p in products if p.recurring_interval is None]
    all_products = subscription_products + onetime_products

    discounts = await _create_discounts(session, organization)
    customers = await _create_customers(session, organization)
    stats.customers = len(customers)

    await _create_subscriptions(
        session, customers, subscription_products, discounts, now, stats
    )
    await _create_onetime_orders(
        session, customers, onetime_products, discounts, now, stats
    )
    await _create_today_orders(session, customers, all_products, now, stats)
    await session.flush()

    await _create_checkouts(session, organization, customers, all_products, now, stats)
    await session.flush()

    await _create_wallets(session, customers, now, stats)
    await session.flush()

    stats.print_summary()
