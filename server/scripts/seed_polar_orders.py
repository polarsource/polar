import asyncio
import random
from datetime import timedelta

import dramatiq
import typer
from sqlalchemy import select
from sqlalchemy.orm import joinedload

import polar.tasks  # noqa: F401
from polar.auth.models import AuthSubject
from polar.kit.address import Address
from polar.kit.db.postgres import create_async_sessionmaker
from polar.kit.utils import utc_now
from polar.models import (
    Customer,
    OrderItem,
    Organization,
    Product,
    User,
    UserOrganization,
)
from polar.models.order import OrderBillingReasonInternal, OrderStatus
from polar.models.payment import PaymentStatus
from polar.postgres import AsyncSession, create_async_engine
from polar.product.schemas import (
    ProductCreateOneTime,
    ProductCreateRecurring,
    ProductPriceFixedCreate,
)
from polar.product.service import product as product_service
from polar.enums import SubscriptionRecurringInterval, TaxBehaviorOption
from polar.kit.currency import PresentmentCurrency
from polar.models.product_price import ProductPriceAmountType
from polar.redis import create_redis
from polar.tax.tax_id import TaxID
from polar.worker import JobQueueManager
from tests.fixtures.database import save_fixture_factory
from tests.fixtures.random_objects import (
    create_customer,
    create_order,
    create_payment,
)

cli = typer.Typer()

POLAR_ORG_SLUG = "polar"

CARD_BRANDS = [
    ("visa", "4242"),
    ("mastercard", "5555"),
    ("amex", "0005"),
    ("discover", "1117"),
]

BILLING_PROFILES: list[dict[str, object]] = [
    {
        "name": "Ada Lovelace",
        "billing_name": "Analytical Engines Inc.",
        "address": Address.model_validate(
            {
                "line1": "2 Finsbury Avenue",
                "city": "London",
                "postal_code": "EC2M 2PA",
                "country": "GB",
            }
        ),
    },
    {
        "name": "Grace Hopper",
        "billing_name": "Cobol Systems LLC",
        "address": Address.model_validate(
            {
                "line1": "1600 Amphitheatre Parkway",
                "city": "Mountain View",
                "state": "CA",
                "postal_code": "94043",
                "country": "US",
            }
        ),
        "tax_id": ("US123456789", "us_ein"),
    },
    {
        "name": "Linus Torvalds",
        "billing_name": "Kernel Labs AB",
        "address": Address.model_validate(
            {
                "line1": "Sveavägen 12",
                "city": "Stockholm",
                "postal_code": "111 57",
                "country": "SE",
            }
        ),
        "tax_id": ("SE556677889901", "eu_vat"),
    },
    {
        "name": "Margaret Hamilton",
        "billing_name": None,
        "address": Address.model_validate(
            {
                "line1": "77 Massachusetts Ave",
                "city": "Cambridge",
                "state": "MA",
                "postal_code": "02139",
                "country": "US",
            }
        ),
    },
    {
        "name": "Alan Turing",
        "billing_name": "Bletchley Park Ltd.",
        "address": Address.model_validate(
            {
                "line1": "The Mansion",
                "city": "Milton Keynes",
                "postal_code": "MK3 6EB",
                "country": "GB",
            }
        ),
    },
]


async def _get_or_create_products(
    session: AsyncSession, organization: Organization, auth_subject: AuthSubject[User]
) -> list[Product]:
    existing = (
        (
            await session.execute(
                select(Product).where(
                    Product.organization_id == organization.id,
                    Product.deleted_at.is_(None),
                )
            )
        )
        .scalars()
        .all()
    )
    if existing:
        return list(existing)

    products_data: list[tuple[str, str, int, SubscriptionRecurringInterval | None]] = [
        ("Pro", "Monthly Pro subscription", 2900, SubscriptionRecurringInterval.month),
        (
            "Scale",
            "Monthly Scale subscription",
            9900,
            SubscriptionRecurringInterval.month,
        ),
        ("Starter Pack", "One-time starter package", 4900, None),
    ]
    created: list[Product] = []
    for name, description, price, interval in products_data:
        price_create = ProductPriceFixedCreate(
            amount_type=ProductPriceAmountType.fixed,
            tax_behavior=TaxBehaviorOption.exclusive,
            price_amount=price,
            price_currency=PresentmentCurrency.usd,
        )
        if interval is None:
            product_create: ProductCreateOneTime | ProductCreateRecurring = (
                ProductCreateOneTime(
                    name=name,
                    description=description,
                    organization_id=organization.id,
                    prices=[price_create],
                )
            )
        else:
            product_create = ProductCreateRecurring(
                name=name,
                description=description,
                organization_id=organization.id,
                recurring_interval=interval,
                prices=[price_create],
            )
        created.append(
            await product_service.create(
                session=session,
                create_schema=product_create,
                auth_subject=auth_subject,
            )
        )
    return created


async def seed_polar_orders(session: AsyncSession, count: int) -> None:
    organization = (
        await session.execute(
            select(Organization).where(Organization.slug == POLAR_ORG_SLUG)
        )
    ).scalar_one_or_none()
    if organization is None:
        typer.echo(
            f"Organization '{POLAR_ORG_SLUG}' not found. Run `uv run task seeds_load` first."
        )
        raise typer.Exit(1)

    owner = (
        (
            await session.execute(
                select(User)
                .join(UserOrganization, UserOrganization.user_id == User.id)
                .where(
                    UserOrganization.organization_id == organization.id,
                    UserOrganization.deleted_at.is_(None),
                    User.deleted_at.is_(None),
                )
                .order_by(UserOrganization.created_at)
            )
        )
        .scalars()
        .first()
    )
    if owner is None:
        typer.echo(f"No member user found for '{POLAR_ORG_SLUG}'.")
        raise typer.Exit(1)

    auth_subject: AuthSubject[User] = AuthSubject(
        subject=owner, scopes=set(), session=None
    )

    save = save_fixture_factory(session)
    products = await _get_or_create_products(session, organization, auth_subject)

    customers = []
    for index, profile in enumerate(BILLING_PROFILES):
        email = f"orders-seed-{index + 1}@polar.sh"
        customer = (
            await session.execute(
                select(Customer)
                .where(
                    Customer.organization_id == organization.id,
                    Customer.email == email,
                    Customer.deleted_at.is_(None),
                )
                .options(joinedload(Customer.organization))
            )
        ).scalar_one_or_none()
        if customer is None:
            customer = await create_customer(
                save,
                organization=organization,
                email=email,
                name=str(profile["name"]),
                billing_name=profile["billing_name"],  # type: ignore[arg-type]
                billing_address=profile["address"],  # type: ignore[arg-type]
                tax_id=TaxID(profile["tax_id"]) if profile.get("tax_id") else None,  # type: ignore[arg-type]
                stripe_customer_id=None,
            )
        customers.append((customer, profile))

    statuses: list[OrderStatus] = [
        OrderStatus.paid,
        OrderStatus.paid,
        OrderStatus.paid,
        OrderStatus.partially_refunded,
        OrderStatus.refunded,
        OrderStatus.pending,
    ]

    created_orders = 0
    now = utc_now()
    for i in range(count):
        customer, profile = customers[i % len(customers)]
        product = products[i % len(products)]
        status = statuses[i % len(statuses)]

        subtotal_amount = random.choice([2900, 4900, 9900, 1900, 9900, 29900])
        tax_amount = round(subtotal_amount * random.choice([0, 0, 0.08, 0.2, 0.25]))
        discount_amount = random.choice([0, 0, 0, 500, 1000])
        refunded_amount = 0
        if status == OrderStatus.refunded:
            refunded_amount = subtotal_amount - discount_amount
        elif status == OrderStatus.partially_refunded:
            refunded_amount = round((subtotal_amount - discount_amount) / 2)

        order_items = [
            OrderItem(
                label=product.name,
                amount=subtotal_amount,
                net_amount=subtotal_amount - discount_amount,
                tax_amount=tax_amount,
                proration=False,
            )
        ]

        order = await create_order(
            save,
            customer=customer,
            product=product,
            status=status,
            subtotal_amount=subtotal_amount,
            tax_amount=tax_amount,
            discount_amount=discount_amount,
            refunded_amount=refunded_amount,
            billing_reason=(
                OrderBillingReasonInternal.subscription_cycle
                if product.is_recurring
                else OrderBillingReasonInternal.purchase
            ),
            billing_name=profile["billing_name"],  # type: ignore[arg-type]
            billing_address=profile["address"],  # type: ignore[arg-type]
            order_items=order_items,
            created_at=now - timedelta(days=random.randint(0, 120)),
            user_metadata={
                "seed": "polar-orders",
                "channel": random.choice(["web", "api", "checkout-link"]),
            },
        )

        brand, last4 = random.choice(CARD_BRANDS)
        card_metadata = {"brand": brand, "last4": last4}
        amount = subtotal_amount + tax_amount - discount_amount
        if status in (
            OrderStatus.paid,
            OrderStatus.partially_refunded,
            OrderStatus.refunded,
        ):
            await create_payment(
                save,
                organization,
                amount=amount,
                method_metadata=card_metadata,
                customer_email=customer.email,
                order=order,
            )
        elif status == OrderStatus.pending:
            # A failed attempt first, so the payments table shows a decline.
            await create_payment(
                save,
                organization,
                status=PaymentStatus.failed,
                amount=amount,
                method_metadata=card_metadata,
                customer_email=customer.email,
                decline_reason="insufficient_funds",
                decline_message="Your card has insufficient funds.",
                order=order,
            )

        created_orders += 1

    await session.commit()
    typer.echo(
        f"✅ Seeded {created_orders} orders for '{organization.name}' "
        f"({len(customers)} customers, {len(products)} products)"
    )


@cli.command()
def main(
    count: int = typer.Option(12, "--count", help="Number of orders to create."),
) -> None:
    """Seed sample orders on the Polar organization."""

    async def run() -> None:
        redis = create_redis("app")
        async with JobQueueManager.open(dramatiq.get_broker(), redis):
            engine = create_async_engine("script")
            sessionmaker = create_async_sessionmaker(engine)
            async with sessionmaker() as session:
                await seed_polar_orders(session, count)
            await engine.dispose()

    asyncio.run(run())


if __name__ == "__main__":
    cli()
