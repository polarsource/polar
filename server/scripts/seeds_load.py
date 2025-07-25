import asyncio
import random
from typing import NotRequired, TypedDict
from uuid import UUID

import dramatiq
import typer
from sqlalchemy.ext.asyncio import AsyncSession

import polar.tasks  # noqa: F401
from polar.auth.models import AuthSubject
from polar.benefit.service import benefit as benefit_service
from polar.benefit.strategies.custom.schemas import BenefitCustomCreate
from polar.benefit.strategies.downloadables.schemas import BenefitDownloadablesCreate

# Import tasks to register all dramatiq actors
from polar.benefit.strategies.license_keys.schemas import BenefitLicenseKeysCreate
from polar.config import settings
from polar.customer.schemas.customer import CustomerCreate
from polar.customer.service import customer as customer_service
from polar.enums import SubscriptionRecurringInterval
from polar.file.s3 import FileServiceTypes
from polar.kit.db.postgres import create_async_engine
from polar.models.benefit import BenefitType
from polar.models.file import File
from polar.models.product_price import ProductPriceAmountType
from polar.organization.schemas import OrganizationCreate
from polar.organization.service import organization as organization_service
from polar.product.schemas import ProductCreate, ProductPriceFixedCreate
from polar.product.service import product as product_service
from polar.redis import Redis, create_redis
from polar.user.repository import UserRepository
from polar.user.service import user as user_service
from polar.worker import JobQueueManager

cli = typer.Typer()


class OrganizationDict(TypedDict):
    name: str
    slug: str
    email: str
    website: str
    bio: str
    products: NotRequired[list["ProductDict"]]
    is_admin: NotRequired[bool]


class ProductDict(TypedDict):
    name: str
    description: str
    price: int
    recurring: SubscriptionRecurringInterval | None
    benefits: NotRequired[list[str]]


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
    elif type is BenefitType.license_keys:
        return BenefitLicenseKeysCreate(**dict_create)  # type: ignore
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
            "products": [
                {
                    "name": "Premium Business Suite",
                    "description": "Complete business management solution",
                    "price": 25000,
                    "recurring": SubscriptionRecurringInterval.month,
                },
                {
                    "name": "Starter Kit",
                    "description": "Everything you need to get started",
                    "price": 5000,
                    "recurring": None,
                },
                {
                    "name": "Enterprise Dashboard",
                    "description": "Advanced analytics and reporting",
                    "price": 5000,
                    "recurring": SubscriptionRecurringInterval.month,
                },
                {
                    "name": "Mobile App License",
                    "description": "Mobile companion app access",
                    "price": 5000,
                    "recurring": None,
                },
            ],
        },
        {
            "name": "Widget Industries",
            "slug": "widget-industries",
            "email": "info@widget-industries.com",
            "website": "https://widget-industries.com",
            "bio": "Manufacturing high-quality widgets since 1985.",
            "products": [
                {
                    "name": "Widget Pro",
                    "description": "Professional-grade widget with extended warranty",
                    "price": 19900,
                    "recurring": None,
                },
                {
                    "name": "Widget Subscription",
                    "description": "Monthly widget delivery service",
                    "price": 1900,
                    "recurring": SubscriptionRecurringInterval.month,
                },
                {
                    "name": "Widget Kit",
                    "description": "Complete widget toolkit for professionals",
                    "price": 9900,
                    "recurring": None,
                },
                {
                    "name": "Widget Plus",
                    "description": "Enhanced widget with premium features",
                    "price": 15900,
                    "recurring": SubscriptionRecurringInterval.month,
                },
                {
                    "name": "Widget Support Package",
                    "description": "Annual maintenance and support",
                    "price": 5000,
                    "recurring": SubscriptionRecurringInterval.month,
                },
            ],
        },
        {
            "name": "MeltedSQL",
            "slug": "melted-sql",
            "email": "support@meltedsql.com",
            "website": "https://meltedsql.com",
            "bio": "Your go-to solution for SQL database management and optimization.",
            "benefits": {
                "melted-sql-premium-support": {
                    "type": BenefitType.custom,
                    "description": "MeltedSQL premium support email",
                },
                "download-link": {
                    "type": BenefitType.downloadables,
                    "description": "MeltedSQL download link",
                    "properties": {
                        "files": [
                            {
                                "name": "meltedsql-download.zip",
                                "mime_type": "application/zip",
                                "url": "https://example.com/meltedsql-download.zip",
                                "path": "/102465214/meltedsql-download.zip",
                                "size": 508484,
                            },
                        ],
                    },
                },
                "license-key": {
                    "type": BenefitType.license_keys,
                    "description": "MeltedSQL license",
                },
            },
            "products": [
                {
                    "name": "MeltedSQL Pro",
                    "description": "SQL management tool that will melt your heart",
                    "price": 19900,
                    "recurring": SubscriptionRecurringInterval.year,
                    "benefits": [
                        "download-link",
                        "license-key",
                    ],
                },
                {
                    "name": "MeltedSQL Corporate",
                    "description": "SQL management tool that will melt your face",
                    "price": 99900,
                    "recurring": SubscriptionRecurringInterval.year,
                    "benefits": [
                        "download-link",
                        "license-key",
                        "melted-sql-premium-support",
                    ],
                },
                {
                    "name": "MeltedSQL Lifetime",
                    "description": "SQL management tool that will melt your heart",
                    "price": 39900,
                    "recurring": None,
                    "benefits": [
                        "download-link",
                        "license-key",
                    ],
                },
            ],
        },
        {
            "name": "ColdMail Inc.",
            "slug": "coldmail",
            "email": "hello@coldmail.com",
            "website": "https://coldmail.com",
            "bio": "Online mail services like it's 1999!",
            "products": [
                {
                    "name": "ColdMail 10 GB",
                    "description": "ColdMail with 10 GB of storage",
                    "price": 1500,
                    "recurring": SubscriptionRecurringInterval.month,
                },
                {
                    "name": "ColdMail 10 GB",
                    "description": "ColdMail with 10 GB of storage",
                    "price": 15000,
                    "recurring": SubscriptionRecurringInterval.year,
                },
                {
                    "name": "ColdMail 50 GB",
                    "description": "ColdMail with 50 GB of storage",
                    "price": 5000,
                    "recurring": SubscriptionRecurringInterval.month,
                },
                {
                    "name": "ColdMail 50 GB",
                    "description": "ColdMail with 50 GB of storage",
                    "price": 50000,
                    "recurring": SubscriptionRecurringInterval.year,
                },
                {
                    "name": "ColdMail 100 GB",
                    "description": "ColdMail with 100 GB of storage",
                    "price": 8000,
                    "recurring": SubscriptionRecurringInterval.month,
                },
                {
                    "name": "ColdMail 100 GB",
                    "description": "ColdMail with 100 GB of storage",
                    "price": 80000,
                    "recurring": SubscriptionRecurringInterval.year,
                },
                {
                    "name": "TemperateDocs Basic",
                    "description": "TemperateDocs with basic document editing",
                    "price": 3000,
                    "recurring": SubscriptionRecurringInterval.month,
                },
                {
                    "name": "TemperateDocs Basic",
                    "description": "TemperateDocs with basic document editing",
                    "price": 30000,
                    "recurring": SubscriptionRecurringInterval.year,
                },
                {
                    "name": "TemperateDocs Pro",
                    "description": "TemperateDocs with sheets, slides, and PDF export",
                    "price": 6000,
                    "recurring": SubscriptionRecurringInterval.month,
                },
                {
                    "name": "TemperateDocs Pro",
                    "description": "TemperateDocs with sheets, slides, and PDF export",
                    "price": 60000,
                    "recurring": SubscriptionRecurringInterval.year,
                },
            ],
        },
        {
            "name": "Admin Org",
            "slug": "admin-org",
            "email": "admin@polar.sh",
            "website": "https://polar.sh",
            "bio": "The admin organization of Polar",
            "is_admin": True,
        },
    ]

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
        "melted-sql": [
            # {
            #     "type": BenefitType.downloadables,
            #     "description": "Exclusive business templates",
            #     "properties": {
            #         "files": ["https://example.com/placeholder-downloadable.pdf"],
            #     },
            # },
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
        user_repository = UserRepository.from_session(session)
        await user_repository.update(
            user, update_dict={"is_admin": org_data.get("is_admin", False)}
        )

        auth_subject = AuthSubject(subject=user, scopes=set(), session=None)

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
        org_benefits = {}
        for key, benefit_data in org_data.get("benefits", {}).items():
            benefit_data["organization_id"] = organization.id

            if benefit_data["type"] == BenefitType.downloadables:
                file_ids = []
                for file_data in benefit_data["properties"]["files"]:
                    instance = File(
                        organization=organization,
                        name=file_data["name"],
                        path=file_data["path"],
                        mime_type=file_data["mime_type"],
                        checksum_sha256_hex="a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e",
                        checksum_sha256_base64="pZGm1Av0IEBKARczz7exkNYsZb8LzaMrV7J32a2fFG4=",
                        size=file_data["size"],
                        service=FileServiceTypes.downloadable,
                        is_enabled=True,
                        is_uploaded=True,
                    )
                    session.add(instance)
                    await session.flush()

                    file_ids.append(instance.id)
                benefit_data["properties"]["files"] = file_ids

            schema = create_benefit_schema(benefit_data)
            benefit = await benefit_service.user_create(
                session=session,
                redis=redis,
                create_schema=schema,
                auth_subject=auth_subject,
            )
            org_benefits[key] = benefit

        # Create products for organization
        for product_data in org_data.get("products", []):
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
                recurring_interval=product_data.get("recurring", None),
                prices=[price_create],
            )

            product = await product_service.create(
                session=session,
                create_schema=product_create,
                auth_subject=auth_subject,
            )

            selected_benefits = product_data.get("benefits", [])
            for benefit_key in selected_benefits:
                await product_service.update_benefits(
                    session=session,
                    product=product,
                    benefits=[org_benefits[key].id for key in selected_benefits],
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
