import asyncio
import random
from typing import NotRequired, TypedDict
from uuid import UUID

import dramatiq
import typer
from sqlalchemy.ext.asyncio import AsyncSession

# Import tasks to register all dramatiq actors
import polar.tasks  # noqa: F401
from polar.auth.models import AuthMethod, AuthSubject
from polar.benefit.service import benefit as benefit_service
from polar.benefit.strategies.custom.schemas import BenefitCustomCreate
from polar.benefit.strategies.downloadables.schemas import BenefitDownloadablesCreate
from polar.config import settings
from polar.customer.schemas.customer import CustomerCreate
from polar.customer.service import customer as customer_service
from polar.enums import SubscriptionRecurringInterval
from polar.kit.db.postgres import create_async_engine
from polar.models.benefit import BenefitType
from polar.models.product_price import ProductPriceAmountType
from polar.organization.schemas import OrganizationCreate
from polar.organization.service import organization as organization_service
from polar.product.schemas import ProductCreate, ProductPriceFixedCreate
from polar.product.service import product as product_service
from polar.redis import Redis, create_redis
from polar.user.service import user as user_service
from polar.worker import JobQueueManager

cli = typer.Typer()


class ProductDict(TypedDict):
    name: str
    description: str
    price: int
    recurring: bool


class BenefitDict(TypedDict):
    type: BenefitType
    organization_id: NotRequired[UUID]
    description: str
    properties: NotRequired[dict[str, str]]


def create_benefit_schema(
    dict_create: BenefitDict,
) -> BenefitCustomCreate | BenefitDownloadablesCreate:
    type = dict_create["type"]
    if "properties" not in dict_create:
        dict_create["properties"] = {}
    if type is BenefitType.custom:
        return BenefitCustomCreate(**dict_create)  # type: ignore
    elif type is BenefitType.downloadables:
        return BenefitDownloadablesCreate(**dict_create)  # type: ignore
    else:
        raise Exception(
            f"Unsupported Benefit type, please go to `create_benefit_schema()` in {__file__} to implement"
        )


async def create_seed_data(session: AsyncSession, redis: Redis) -> None:
    """Create sample data for development and testing."""

    # Organizations data
    orgs_data = [
        {
            "name": "Acme Corporation",
            "slug": "acme-corp",
            "email": "contact@acme-corp.com",
            "website": "https://acme-corp.com",
            "bio": "Leading provider of innovative solutions for modern businesses.",
        },
        {
            "name": "Widget Industries",
            "slug": "widget-industries",
            "email": "info@widget-industries.com",
            "website": "https://widget-industries.com",
            "bio": "Manufacturing high-quality widgets since 1985.",
        },
        {
            "name": "Placeholder Enterprises",
            "slug": "placeholder-enterprises",
            "email": "hello@placeholder.com",
            "website": "https://placeholder.com",
            "bio": "Your go-to solution for all placeholder needs.",
        },
        {
            "name": "Admin Org",
            "slug": "admin-org",
            "email": "admin@polar.sh",
            "website": "https://polar.sh",
            "bio": "The admin organization of Polar",
        },
    ]

    # Products data for each organization
    products_data: dict[str, list[ProductDict]] = {
        "acme-corp": [
            {
                "name": "Premium Business Suite",
                "description": "Complete business management solution",
                "price": 25000,
                "recurring": True,
            },
            {
                "name": "Starter Kit",
                "description": "Everything you need to get started",
                "price": 5000,
                "recurring": False,
            },
            {
                "name": "Enterprise Dashboard",
                "description": "Advanced analytics and reporting",
                "price": 5000,
                "recurring": True,
            },
            {
                "name": "Mobile App License",
                "description": "Mobile companion app access",
                "price": 5000,
                "recurring": False,
            },
        ],
        "widget-industries": [
            {
                "name": "Widget Pro",
                "description": "Professional-grade widget with extended warranty",
                "price": 19900,
                "recurring": False,
            },
            {
                "name": "Widget Subscription",
                "description": "Monthly widget delivery service",
                "price": 1900,
                "recurring": True,
            },
            {
                "name": "Widget Kit",
                "description": "Complete widget toolkit for professionals",
                "price": 9900,
                "recurring": False,
            },
            {
                "name": "Widget Plus",
                "description": "Enhanced widget with premium features",
                "price": 15900,
                "recurring": True,
            },
            {
                "name": "Widget Support Package",
                "description": "Annual maintenance and support",
                "price": 5000,
                "recurring": True,
            },
        ],
        "placeholder-enterprises": [
            {
                "name": "Placeholder Pro",
                "description": "Professional placeholder service",
                "price": 9999,
                "recurring": True,
            },
            {
                "name": "Demo Content Pack",
                "description": "High-quality demo content and assets",
                "price": 1999,
                "recurring": False,
            },
            {
                "name": "Placeholder API",
                "description": "RESTful API for placeholder generation",
                "price": 5000,
                "recurring": True,
            },
        ],
    }

    # Benefits data for each organization
    benefits_data: dict[str, list[BenefitDict]] = {
        "acme-corp": [
            {"type": BenefitType.custom, "description": "Priority customer support"},
            # {
            #     "type": BenefitType.downloadables,
            #     "description": "Exclusive business templates",
            #     "properties": {
            #         "files": ["https://example.com/placeholder-downloadable.pdf"],
            #     },
            # },
        ],
        "widget-industries": [
            {"type": BenefitType.custom, "description": "Free shipping on all orders"},
        ],
        "placeholder-enterprises": [
            {"type": BenefitType.custom, "description": "24/7 placeholder support"},
            # {
            #     "type": BenefitType.downloadables,
            #     "description": "Premium placeholder assets",
            #     "properties": {
            #         "files": ["https://example.com/placeholder-downloadable.png"],
            #     },
            # },
        ],
    }

    # Create organizations with users and sample data
    for org_data in orgs_data:
        # Create user first
        user = await user_service.create_by_email(
            session=session,
            email=org_data["email"],
        )

        auth_subject = AuthSubject(subject=user, scopes=set(), method=AuthMethod.NONE)

        # Create organization
        organization = await organization_service.create(
            session=session,
            create_schema=OrganizationCreate(
                name=org_data["name"],
                slug=org_data["slug"],
            ),
            auth_subject=auth_subject,
        )

        # Update organization with additional details
        organization.email = org_data["email"]
        organization.website = org_data["website"]
        organization.bio = org_data["bio"]
        session.add(organization)

        # Create benefits for organization
        org_benefits = []
        for benefit_data in benefits_data.get(org_data["slug"], []):
            benefit_data["organization_id"] = organization.id
            schema = create_benefit_schema(benefit_data)
            benefit = await benefit_service.user_create(
                session=session,
                redis=redis,
                create_schema=schema,
                auth_subject=auth_subject,
            )
            org_benefits.append(benefit)

        # Create products for organization
        for product_data in products_data.get(org_data["slug"], []):
            # Create price for product
            price_create = ProductPriceFixedCreate(
                amount_type=ProductPriceAmountType.fixed,
                price_amount=product_data["price"],
                price_currency="usd",
            )

            product_create = ProductCreate(
                name=product_data["name"],
                description=product_data["description"],
                organization_id=organization.id,
                recurring_interval=SubscriptionRecurringInterval.month
                if product_data["recurring"]
                else None,
                prices=[price_create],
            )

            product = await product_service.create(
                session=session,
                create_schema=product_create,
                auth_subject=auth_subject,
            )

            # Add benefits to product (randomly assign 0-2 benefits)
            selected_benefits = random.sample(
                org_benefits, min(len(org_benefits), random.randint(0, 2))
            )
            for benefit in selected_benefits:
                await product_service.update_benefits(
                    session=session,
                    product=product,
                    benefits=[b.id for b in org_benefits],
                    auth_subject=auth_subject,
                )

        # Create customers for organization
        num_customers = random.randint(0, 5)
        for i in range(num_customers):
            # customer_email = f"customer_{org_data['slug']}_{i + 1}@example.com"
            customer_email = f"customer_{org_data['slug']}_{i + 1}@polar.sh"
            customer = await customer_service.create(
                session=session,
                customer_create=CustomerCreate(
                    email=customer_email,
                    name=f"Customer {i + 1}",
                    organization_id=organization.id,
                ),
                auth_subject=auth_subject,
            )

            # TODO: Create some checkouts for customers
            # This would require more complex checkout creation logic
            pass

    await session.commit()
    print("✅ Sample data created successfully!")
    print("Created 3 organizations with users, products, benefits, and customers")


@cli.command()
def seeds_load() -> None:
    """Load sample/test data into the database."""

    async def run() -> None:
        redis = create_redis("app")
        async with JobQueueManager.open(dramatiq.get_broker(), redis):
            engine = create_async_engine(
                dsn=str(settings.get_postgres_dsn("asyncpg")),
                pool_size=5,
                pool_recycle=3600,
            )
            async with engine.begin() as conn:
                async with AsyncSession(bind=conn, expire_on_commit=False) as session:
                    await create_seed_data(session, redis)

    asyncio.run(run())


if __name__ == "__main__":
    cli()
