import asyncio
import random
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any, Literal, NotRequired, TypedDict

import dramatiq
import typer

import polar.tasks  # noqa: F401
from polar.auth.models import AuthSubject
from polar.benefit.service import benefit as benefit_service
from polar.benefit.strategies.custom.schemas import BenefitCustomCreate
from polar.benefit.strategies.downloadables.schemas import BenefitDownloadablesCreate

# Import tasks to register all dramatiq actors
from polar.benefit.strategies.license_keys.schemas import BenefitLicenseKeysCreate
from polar.checkout_link.schemas import CheckoutLinkCreateProducts
from polar.checkout_link.service import checkout_link as checkout_link_service
from polar.customer.schemas.customer import CustomerCreate
from polar.customer.service import customer as customer_service
from polar.enums import AccountType, PaymentProcessor, SubscriptionRecurringInterval
from polar.event.repository import EventRepository
from polar.kit.db.postgres import create_async_sessionmaker
from polar.kit.utils import utc_now
from polar.meter.aggregation import CountAggregation
from polar.meter.filter import Filter, FilterClause, FilterConjunction, FilterOperator
from polar.meter.schemas import MeterCreate
from polar.meter.service import meter as meter_service
from polar.models.account import Account
from polar.models.benefit import BenefitType
from polar.models.file import File, FileServiceTypes
from polar.models.organization import Organization, OrganizationDetails
from polar.models.product_price import ProductPriceAmountType
from polar.models.user import IdentityVerificationStatus
from polar.organization.schemas import OrganizationCreate
from polar.organization.service import organization as organization_service
from polar.postgres import AsyncSession, create_async_engine
from polar.product.schemas import (
    ProductCreate,
    ProductPriceFixedCreate,
    ProductPriceMeteredUnitCreate,
)
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
    status: NotRequired[Organization.Status]
    subscriptions_billing_engine: NotRequired[bool]
    details: NotRequired[OrganizationDetails]
    products: NotRequired[list["ProductDict"]]
    benefits: NotRequired[dict[str, "BenefitDict"]]
    is_admin: NotRequired[bool]


class ProductDict(TypedDict):
    name: str
    description: str
    price: NotRequired[int]
    recurring: SubscriptionRecurringInterval | None
    benefits: NotRequired[list[str]]
    metered: NotRequired[bool]
    unit_amount: NotRequired[float]
    cap_amount: NotRequired[int | None]


class BenefitDictBase(TypedDict):
    description: str


class BenefitCustomDict(BenefitDictBase):
    type: Literal[BenefitType.custom]


class FileDict(TypedDict):
    name: str
    mime_type: str
    url: str
    path: str
    size: int


class PropertiesFileDict(TypedDict):
    files: list[FileDict]


class BenefitFileDict(BenefitDictBase):
    type: Literal[BenefitType.downloadables]
    properties: PropertiesFileDict
    # properties: TypedDict[{"files": list[FileDict]}]


class BenefitLicenseDict(BenefitDictBase):
    type: Literal[BenefitType.license_keys]


type BenefitDict = BenefitCustomDict | BenefitFileDict | BenefitLicenseDict


def create_benefit_schema(
    dict_input: Any,
) -> BenefitCustomCreate | BenefitDownloadablesCreate | BenefitLicenseKeysCreate:
    type = dict_input["type"]

    dict_create = {
        "properties": {},
        **dict_input,
    }

    if type is BenefitType.custom:
        return BenefitCustomCreate(**dict_create)
    elif type is BenefitType.downloadables:
        return BenefitDownloadablesCreate(**dict_create)
    elif type is BenefitType.license_keys:
        return BenefitLicenseKeysCreate(**dict_create)
    else:
        raise Exception(
            f"Unsupported Benefit type, please go to `create_benefit_schema()` in {__file__} to implement"
        )


async def create_seed_data(session: AsyncSession, redis: Redis) -> None:
    """Create sample data for development and testing."""

    # Organizations data
    orgs_data: list[OrganizationDict] = [
        {
            "name": "Acme Corporation",
            "slug": "acme-corp",
            "email": "contact@acme-corp.com",
            "website": "https://acme-corp.com",
            "bio": "Leading provider of innovative solutions for modern businesses.",
            "status": Organization.Status.ACTIVE,
            "details": {
                "about": "We provide business intelligence dashboard",
                "intended_use": "Well have a checkout on our website granting.",
                "switching": False,
                "switching_from": None,
                "product_description": "Our business intellignce dashboard are mostly monthly subscriptions, but our mobile app is accessible after a one-time payment.",
                "customer_acquisition": ["website"],
                "future_annual_revenue": 2000000,
                "previous_annual_revenue": 0,
            },
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
            "status": Organization.Status.ACTIVE,
            "subscriptions_billing_engine": True,
            "details": {
                "about": "We make beautiful SQL management products for macOS.",
                "intended_use": "Well have a checkout on our website granting a download link and license key.",
                "switching": False,
                "switching_from": None,
                "product_description": "The desktop apps that we create allows connecting to SQL databases, and performing queries on those databases.",
                "customer_acquisition": ["website"],
                "future_annual_revenue": 2000000,
                "previous_annual_revenue": 0,
            },
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
                    "name": "MeltedSQL Basic",
                    "description": "SQL management tool that will melt your heart",
                    "price": 9900,
                    "recurring": SubscriptionRecurringInterval.month,
                    "benefits": [
                        "download-link",
                        "license-key",
                    ],
                },
                {
                    "name": "MeltedSQL Pro",
                    "description": "SQL management tool that will melt your brain",
                    "price": 19900,
                    "recurring": SubscriptionRecurringInterval.month,
                    "benefits": [
                        "download-link",
                        "license-key",
                    ],
                },
                {
                    "name": "MeltedSQL Corporate",
                    "description": "SQL management tool that will melt your face",
                    "price": 99900,
                    "recurring": SubscriptionRecurringInterval.month,
                    "benefits": [
                        "download-link",
                        "license-key",
                        "melted-sql-premium-support",
                    ],
                },
                {
                    "name": "MeltedSQL Lifetime",
                    "description": "SQL management tool that will never melt!",
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
            "status": Organization.Status.ACTIVE,
            "details": {
                "about": "We're a hottest cloud provider since sliced bread",
                "intended_use": "We'll be selling various plans allowing access to our cloud storage and cloud document services.",
                "switching": False,
                "switching_from": None,
                "product_description": "We sell ColdMail which provides an email inbox plus file storage. We also sell TemperateDocs which allows creating and editing documents online.",
                "customer_acquisition": ["website"],
                "future_annual_revenue": 2000000,
                "previous_annual_revenue": 0,
            },
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
                {
                    "name": "Coldmail Pay-As-You-Go",
                    "description": "Pay per email sent - perfect for low-volume or occasional use",
                    "recurring": SubscriptionRecurringInterval.month,
                    "metered": True,
                    "unit_amount": 0.01,  # $0.01 per email
                    "cap_amount": 10000,  # $100 maximum per month
                },
            ],
        },
        {
            "name": "Example News Inc.",
            "slug": "example-news-inc",
            "email": "hello@examplenewsinc.com",
            "website": "https://examplenewsinc.com",
            "bio": "Your source of news",
            "status": Organization.Status.ACTIVE,
            "details": {
                "about": "We provide news in various formats",
                "intended_use": "We'll have a checkout on our website where you buy subscriptions to our various news products.",
                "switching": False,
                "switching_from": None,
                "product_description": "We send out our news products as emails daily and weekly",
                "customer_acquisition": ["website"],
                "future_annual_revenue": 2000000,
                "previous_annual_revenue": 0,
            },
            "products": [
                {
                    "name": "Daily newspaper",
                    "description": "Your source of truthful, subjective daily news",
                    "price": 800,
                    "recurring": SubscriptionRecurringInterval.day,
                },
                {
                    "name": "Daily tabloid",
                    "description": "Slander like there's no tomorrow!",
                    "price": 1000,
                    "recurring": SubscriptionRecurringInterval.day,
                },
                {
                    "name": "Weekly paper",
                    "description": "In-depth journalism and the weekly crossword",
                    "price": 2500,
                    "recurring": SubscriptionRecurringInterval.week,
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
            user,
            update_dict={
                # Start with the user being admin, so that we can create daily and weekly products
                "is_admin": True,
                "identity_verification_status": IdentityVerificationStatus.verified,
                "identity_verification_id": f"vs_{org_data['slug']}_test",
            },
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
        organization.details = org_data.get("details", {})  # type: ignore
        organization.details_submitted_at = utc_now()
        organization.status = org_data.get("status", Organization.Status.CREATED)
        organization.subscriptions_billing_engine = org_data.get(
            "subscriptions_billing_engine", False
        )
        session.add(organization)

        # Create an Account for all organizations except Widget Industries
        if org_data["slug"] != "widget-industries":
            account = Account(
                account_type=AccountType.stripe,
                admin_id=user.id,
                stripe_id=f"acct_{organization.slug}_test",  # Test Stripe account ID
                country="US",
                currency="USD",
                is_details_submitted=True,
                is_charges_enabled=True,
                is_payouts_enabled=True,
                status=Account.Status.ACTIVE,
                email=org_data["email"],
                processor_fees_applicable=True,
            )
            session.add(account)
            await session.flush()

            # Link the account to the organization
            organization.account_id = account.id
            session.add(organization)

        # Create benefits for organization
        org_benefits = {}
        for key, benefit_data in org_data.get("benefits", {}).items():
            benefit_schema_dict: Any = benefit_data.copy()
            benefit_schema_dict["organization_id"] = organization.id

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
                benefit_schema_dict["properties"]["files"] = file_ids

            schema = create_benefit_schema(benefit_schema_dict)
            benefit = await benefit_service.user_create(
                session=session,
                redis=redis,
                create_schema=schema,
                auth_subject=auth_subject,
            )
            org_benefits[key] = benefit

        # Create meter for ColdMail organization
        coldmail_meter = None
        if org_data["slug"] == "coldmail":
            meter_create = MeterCreate(
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
                organization_id=organization.id,
            )
            coldmail_meter = await meter_service.create(
                session=session,
                meter_create=meter_create,
                auth_subject=auth_subject,
            )

        # Create products for organization
        org_products = []
        for product_data in org_data.get("products", []):
            # Handle metered products
            price_create: ProductPriceMeteredUnitCreate | ProductPriceFixedCreate
            if product_data.get("metered", False) and coldmail_meter:
                price_create = ProductPriceMeteredUnitCreate(
                    amount_type=ProductPriceAmountType.metered_unit,
                    price_currency="usd",
                    unit_amount=Decimal(str(product_data["unit_amount"])),
                    meter_id=coldmail_meter.id,
                    cap_amount=product_data.get("cap_amount"),
                )
            else:
                # Create fixed price for product
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
            org_products.append(product)

            selected_benefits = product_data.get("benefits", [])
            for benefit_key in selected_benefits:
                await product_service.update_benefits(
                    session=session,
                    product=product,
                    benefits=[org_benefits[key].id for key in selected_benefits],
                    auth_subject=auth_subject,
                )

        # Create CheckoutLink with all products
        if org_products:
            checkout_link_create = CheckoutLinkCreateProducts(
                payment_processor=PaymentProcessor.stripe,
                products=[product.id for product in org_products],
                label=f"{org_data['name']} store",
                allow_discount_codes=True,
            )
            await checkout_link_service.create(
                session=session,
                checkout_link_create=checkout_link_create,
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

            # Create meter events for ColdMail customers
            if org_data["slug"] == "coldmail" and coldmail_meter and i == 0:
                # Create events for the first customer showing usage over time
                event_repository = EventRepository.from_session(session)
                events_to_insert = []

                # Create 150 email send events over the past 30 days
                base_time = datetime.now(UTC) - timedelta(days=30)

                for day in range(30):
                    # Variable number of emails per day (between 1 and 10)
                    num_emails = random.randint(1, 10)
                    for _ in range(num_emails):
                        event_time = base_time + timedelta(
                            days=day,
                            hours=random.randint(0, 23),
                            minutes=random.randint(0, 59),
                        )
                        events_to_insert.append(
                            {
                                "name": "email_sent",
                                "source": "user",
                                "timestamp": event_time,
                                "organization_id": organization.id,
                                "customer_id": customer.id,
                                "user_metadata": {
                                    "type": "email_sent",
                                    "recipient": f"user{random.randint(1, 100)}@example.com",
                                    "subject": f"Email subject {random.randint(1, 1000)}",
                                },
                            }
                        )

                # Insert all events in batch
                if events_to_insert:
                    await event_repository.insert_batch(events_to_insert)

            # TODO: Create some checkouts for customers
            # This would require more complex checkout creation logic
            pass

        # Downgrade user from admin (for non-admin users)
        await user_repository.update(
            user, update_dict={"is_admin": org_data.get("is_admin", False)}
        )

    await session.commit()
    print("✅ Sample data created successfully!")
    print("Created 3 organizations with users, products, benefits, and customers")


@cli.command()
def seeds_load() -> None:
    """Load sample/test data into the database."""

    async def run() -> None:
        redis = create_redis("app")
        async with JobQueueManager.open(dramatiq.get_broker(), redis):
            engine = create_async_engine("script")
            sessionmaker = create_async_sessionmaker(engine)
            async with sessionmaker() as session:
                await create_seed_data(session, redis)

    asyncio.run(run())


if __name__ == "__main__":
    cli()
