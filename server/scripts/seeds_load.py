import asyncio
import random
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from enum import StrEnum
from pathlib import Path
from time import monotonic
from typing import Any, Literal, NotRequired, TypedDict
from uuid import NAMESPACE_URL, UUID, uuid5

import dramatiq
import typer
from sqlalchemy import delete, func, select
from sqlalchemy import event as sqlalchemy_event
from sqlalchemy.orm import joinedload, selectinload

import polar.tasks  # noqa: F401
from polar.auth.models import AuthSubject
from polar.auth.scope import Scope
from polar.benefit.schemas import BenefitCreate
from polar.benefit.strategies.custom.schemas import BenefitCustomCreate
from polar.benefit.strategies.downloadables.schemas import BenefitDownloadablesCreate
from polar.benefit.strategies.feature_flag.schemas import (
    BenefitFeatureFlagCreate,
    BenefitFeatureFlagCreateProperties,
)

# Import tasks to register all dramatiq actors
from polar.benefit.strategies.license_keys.schemas import BenefitLicenseKeysCreate
from polar.config import settings
from polar.customer.schemas.customer import CustomerIndividualCreate
from polar.customer.service import customer as customer_service
from polar.customer_session.service import CUSTOMER_SESSION_TOKEN_PREFIX
from polar.dispute.dispute_case import dispute_case as dispute_case_service
from polar.enums import (
    PaymentProcessor,
    PayoutAccountType,
    SubscriptionProrationBehavior,
    SubscriptionRecurringInterval,
    TaxBehavior,
    TaxBehaviorOption,
)
from polar.event.repository import EventRepository
from polar.event.service import event as event_service
from polar.event.system import SystemEvent as SystemEventEnum
from polar.event_type.repository import EventTypeRepository
from polar.integrations.tinybird.client import client as tinybird_client
from polar.integrations.tinybird.service import DATASOURCE_EVENTS
from polar.integrations.tinybird.service import ingest_events as tinybird_ingest_events
from polar.kit.crypto import generate_token, generate_token_hash_pair
from polar.kit.currency import PresentmentCurrency
from polar.kit.db.postgres import create_async_sessionmaker
from polar.kit.utils import generate_uuid, utc_now
from polar.kit.visibility import Visibility
from polar.meter.aggregation import CountAggregation
from polar.meter.filter import Filter, FilterClause, FilterConjunction, FilterOperator
from polar.models.benefit import Benefit, BenefitType
from polar.models.checkout import Checkout, CheckoutStatus
from polar.models.checkout_link import CheckoutLink
from polar.models.checkout_link_product import CheckoutLinkProduct
from polar.models.checkout_product import CheckoutProduct
from polar.models.customer import Customer, CustomerType
from polar.models.customer_seat import CustomerSeat, SeatStatus
from polar.models.customer_session import CustomerSession
from polar.models.discount import DiscountDuration, DiscountPercentage
from polar.models.event import Event as EventModel
from polar.models.file import File, FileServiceTypes
from polar.models.member import Member, MemberRole
from polar.models.meter import Meter
from polar.models.order import Order
from polar.models.organization import (
    Organization,
    OrganizationCustomerEmailSettings,
    OrganizationDetails,
    OrganizationStatus,
)
from polar.models.organization_access_token import OrganizationAccessToken
from polar.models.organization_review import OrganizationReview
from polar.models.organization_sso_connection import (
    OrganizationSSOConnection,
    OrganizationSSOConnectionType,
)
from polar.models.payout_account import PayoutAccount
from polar.models.product import Product
from polar.models.product_benefit import ProductBenefit
from polar.models.product_price import (
    ProductPriceAmountType,
    ProductPriceFixed,
    ProductPriceSeatUnit,
)
from polar.models.subscription import Subscription, SubscriptionStatus
from polar.models.subscription_product_price import SubscriptionProductPrice
from polar.models.support_case import (
    SupportCase,
    SupportCaseAudience,
    SupportCaseMessage,
    SupportCaseMessageAuthorKind,
    SupportCaseType,
)
from polar.models.user import IdentityVerificationStatus, User
from polar.models.user_organization import UserOrganization
from polar.models.webhook_endpoint import (
    WebhookEndpoint,
    WebhookEventType,
    WebhookFormat,
)
from polar.organization.schemas import OrganizationCreate
from polar.organization.service import organization as organization_service
from polar.organization_review.appeal_case import appeal_case as appeal_case_service
from polar.postgres import AsyncSession, create_async_engine
from polar.product.schemas import (
    ProductCreate,
    ProductCreateOneTime,
    ProductCreateRecurring,
    ProductPriceFixedCreate,
    ProductPriceMeteredUnitCreate,
    ProductPriceSeatBasedCreate,
    ProductPriceSeatTier,
    ProductPriceSeatTiers,
)
from polar.product.service import product as product_service
from polar.redis import Redis, create_redis
from polar.support_case.service import support_case as support_case_service
from polar.user.repository import UserRepository
from polar.user.service import user as user_service
from polar.webhook.constants import WEBHOOK_SECRET_PREFIX
from polar.worker import JobQueueManager
from scripts.seed_polar_for_polar import (
    BENEFITS as POLAR_SELF_BENEFITS,
)
from scripts.seed_polar_for_polar import (
    PRODUCTS as POLAR_SELF_PRODUCTS,
)
from tests.fixtures.database import save_fixture_factory
from tests.fixtures.random_objects import (
    create_dispute,
    create_order,
    create_payment,
)

cli = typer.Typer(invoke_without_command=True)

# Chosen to stay well under Tinybird's 10MB payload limit at ~2KB/event.
TINYBIRD_FLUSH_CHUNK = 2500
SEED_RANDOM_SEED = 20250814
SIMPLE_COMPLEMENT_SEED_VERSION = "v1"
SIMPLE_COMPLEMENT_EVENT_NAMESPACE = "polar_seed_simple_complement:"
SIMPLE_COMPLEMENT_EVENT_PREFIX = (
    f"{SIMPLE_COMPLEMENT_EVENT_NAMESPACE}{SIMPLE_COMPLEMENT_SEED_VERSION}:"
)
SEEDED_APPEAL_MESSAGE = (
    "Sure — https://example.com. We sell developer tooling subscriptions."
)
SEEDED_DISPUTE_MESSAGE = (
    "This was a legitimate purchase — receipt and delivery attached."
)
EXPECTED_ORGANIZATION_SLUGS = {
    "acme-corp",
    "admin-org",
    "coldmail",
    "example-news-inc",
    "melted-sql",
    "polar",
    "seatbased-members-corp",
    "seatbased-only-corp",
    "widget-industries",
}


class SeedPhase(StrEnum):
    all = "all"
    simple = "simple"
    simple_complement = "simple-complement"


async def _flush_tinybird_events(
    events: Sequence[EventModel],
    ancestors_by_event: dict[UUID, list[str]],
) -> None:
    """Send accumulated events to Tinybird, chunked under the payload limit."""
    for start in range(0, len(events), TINYBIRD_FLUSH_CHUNK):
        await tinybird_ingest_events(
            events[start : start + TINYBIRD_FLUSH_CHUNK], ancestors_by_event
        )


class SeatBasedCustomerDict(TypedDict):
    email: str
    name: str
    seats_purchased: int
    seats_allocated: int


class OrganizationDict(TypedDict):
    name: str
    slug: str
    email: str
    website: str
    bio: str
    status: NotRequired[OrganizationStatus]
    details: NotRequired[OrganizationDetails]
    products: NotRequired[list["ProductDict"]]
    benefits: NotRequired[dict[str, "BenefitDict"]]
    is_admin: NotRequired[bool]
    feature_settings: NotRequired[dict[str, bool]]
    customer_email_settings: NotRequired[OrganizationCustomerEmailSettings]
    seat_based_customers: NotRequired[list[SeatBasedCustomerDict]]
    sso_connection: NotRequired["SSOConnectionDict"]


class SSOConnectionDict(TypedDict):
    name: str
    issuer: str
    client_id: str
    client_secret: str


class ProductDict(TypedDict):
    name: str
    description: str
    price: NotRequired[int]
    recurring: SubscriptionRecurringInterval | None
    benefits: NotRequired[list[str]]
    metered: NotRequired[bool]
    unit_amount: NotRequired[float]
    cap_amount: NotRequired[int | None]
    seat_based: NotRequired[bool]
    price_per_seat: NotRequired[int]


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


async def create_fake_payout_account(
    session: AsyncSession,
    organization: Organization,
    admin: User,
    *,
    country: str = "US",
    currency: str = "usd",
) -> PayoutAccount:
    """Attach a fake, fully-enabled Stripe PayoutAccount to `organization`.

    Mirrors `tests/fixtures/random_objects.create_payout_account` so seeded orgs
    pass `Organization.get_ready_payout_account()` checks out of the box.
    """
    payout_account = PayoutAccount(
        type=PayoutAccountType.stripe,
        admin=admin,
        stripe_id=f"acct_seed_{organization.slug}",
        country=country,
        currency=currency,
        is_details_submitted=True,
        is_charges_enabled=True,
        is_payouts_enabled=True,
    )
    session.add(payout_account)
    await session.flush()
    organization.payout_account = payout_account
    session.add(organization)
    return payout_account


def _create_seed_customer(
    session: AsyncSession,
    organization: Organization,
    *,
    email: str | None,
    name: str,
    customer_type: CustomerType = CustomerType.individual,
    external_id: str | None = None,
    owner_email: str | None = None,
    owner_name: str | None = None,
    owner_external_id: str | None = None,
    created_at: datetime | None = None,
) -> Customer:
    customer = Customer(
        id=generate_uuid(),
        email=email,
        name=name,
        external_id=external_id,
        organization=organization,
        _type=customer_type,
    )
    if created_at is not None:
        customer.created_at = created_at
    session.add(customer)

    if organization.feature_settings.get(
        "member_model_enabled", False
    ) or organization.feature_settings.get("seat_based_pricing_enabled", False):
        member_email = owner_email or email
        if member_email is None:
            raise ValueError("Seed customers with members require an owner email")
        customer.members = [
            Member(
                id=generate_uuid(),
                customer_id=customer.id,
                organization_id=organization.id,
                email=member_email,
                name=owner_name or name,
                external_id=owner_external_id or external_id,
                role=MemberRole.owner,
                created_at=customer.created_at,
            )
        ]

    return customer


def _create_seed_benefit(
    session: AsyncSession,
    organization: Organization,
    schema: BenefitCreate,
) -> Benefit:
    is_tax_applicable = getattr(
        schema, "is_tax_applicable", schema.type.is_tax_applicable()
    )
    benefit = Benefit(
        id=generate_uuid(),
        type=schema.type,
        description=schema.description,
        organization=organization,
        is_tax_applicable=is_tax_applicable,
        properties=schema.properties.model_dump(mode="json", by_alias=True),
        visibility=schema.type.resolve_visibility(schema.visibility),
        user_metadata=schema.metadata,
    )
    session.add(benefit)
    return benefit


async def _stamp_event_type_ids(
    session: AsyncSession, events: list[dict[str, Any]]
) -> None:
    """Stamp event_type_id on each event dict, mirroring the real ingest path."""
    event_type_repository = EventTypeRepository.from_session(session)
    names_by_organization: dict[UUID, set[str]] = {}
    for event in events:
        name = event.get("name")
        organization_id = event.get("organization_id")
        if not name or not organization_id:
            continue
        names_by_organization.setdefault(organization_id, set()).add(name)

    event_type_ids: dict[tuple[UUID, str], UUID] = {}
    for organization_id, names in names_by_organization.items():
        ensured = await event_type_repository.ensure_by_names(
            sorted(names), organization_id
        )
        event_type_ids.update(
            {
                (organization_id, name): event_type.id
                for name, event_type in ensured.items()
            }
        )

    for event in events:
        name = event.get("name")
        event_organization_id = event.get("organization_id")
        if name and event_organization_id:
            event["event_type_id"] = event_type_ids[(event_organization_id, name)]


def _normalize_seed_event_batch(events: list[dict[str, Any]]) -> None:
    for event in events:
        event.setdefault("external_id", None)
        event.setdefault("parent_id", None)


def _generate_seed_uuid(rng: random.Random) -> UUID:
    return UUID(int=rng.getrandbits(128), version=4)


def _build_customer_timeline_events(
    organization_id: Any,
    customer_id: Any,
    customer_email: str,
    customer_name: str,
    products: list[Product],
    rng: random.Random | None = None,
) -> list[dict[str, Any]]:
    """Generate a realistic timeline of system events for a customer.

    Simulates a customer lifecycle: creation → checkout → subscription →
    recurring cycles with order payments → possible cancellation/refund.
    """
    events: list[dict[str, Any]] = []
    rng = rng or random.Random()
    now = datetime.now(UTC)

    days_ago = rng.randint(90, 540)
    timeline_start = now - timedelta(days=days_ago)

    def _evt(
        name: str, timestamp: datetime, metadata: dict[str, Any]
    ) -> dict[str, Any]:
        return {
            "name": name,
            "source": "system",
            "timestamp": timestamp,
            "organization_id": organization_id,
            "customer_id": customer_id,
            "user_metadata": metadata,
        }

    # 1. Customer created
    t = timeline_start
    events.append(
        _evt(
            SystemEventEnum.customer_created,
            t,
            {
                "customer_id": str(customer_id),
                "customer_email": customer_email,
                "customer_name": customer_name,
                "customer_external_id": None,
            },
        )
    )

    # Pick a product for this customer's subscription journey
    recurring_products = [p for p in products if p.recurring_interval is not None]
    onetime_products = [p for p in products if p.recurring_interval is None]

    # 2. Checkout created
    t += timedelta(minutes=rng.randint(1, 30))
    chosen_product = rng.choice(recurring_products) if recurring_products else None
    if chosen_product:
        fake_checkout_id = str(_generate_seed_uuid(rng))
        events.append(
            _evt(
                SystemEventEnum.checkout_created,
                t,
                {
                    "checkout_id": fake_checkout_id,
                    "checkout_status": "succeeded",
                    "product_id": str(chosen_product.id),
                },
            )
        )

        # 3. Subscription created
        t += timedelta(minutes=rng.randint(1, 5))
        fake_sub_id = str(_generate_seed_uuid(rng))
        price_amount = 2900
        for p in chosen_product.all_prices:
            pa = getattr(p, "price_amount", None)
            if pa is not None:
                price_amount = pa
                break
        interval = chosen_product.recurring_interval or "month"
        events.append(
            _evt(
                SystemEventEnum.subscription_created,
                t,
                {
                    "subscription_id": fake_sub_id,
                    "product_id": str(chosen_product.id),
                    "amount": price_amount,
                    "currency": "usd",
                    "recurring_interval": str(interval),
                    "recurring_interval_count": 1,
                    "started_at": t.isoformat(),
                },
            )
        )

        # 4. Initial order paid
        t += timedelta(seconds=rng.randint(1, 30))
        fake_order_id = str(_generate_seed_uuid(rng))
        events.append(
            _evt(
                SystemEventEnum.order_paid,
                t,
                {
                    "order_id": fake_order_id,
                    "product_id": str(chosen_product.id),
                    "amount": price_amount,
                    "currency": "usd",
                    "net_amount": int(price_amount * 0.95),
                    "tax_amount": int(price_amount * 0.05),
                    "subscription_id": fake_sub_id,
                    "recurring_interval": str(interval),
                    "recurring_interval_count": 1,
                },
            )
        )

        # 5. Benefit granted (if product has benefits)
        t += timedelta(seconds=rng.randint(1, 10))
        fake_benefit_id = str(_generate_seed_uuid(rng))
        fake_grant_id = str(_generate_seed_uuid(rng))
        events.append(
            _evt(
                SystemEventEnum.benefit_granted,
                t,
                {
                    "benefit_id": fake_benefit_id,
                    "benefit_grant_id": fake_grant_id,
                    "benefit_type": "custom",
                },
            )
        )

        # 6. Subscription cycles + order payments over time
        interval_days = {"day": 1, "week": 7, "month": 30, "year": 365}
        cycle_days = interval_days.get(str(interval), 30)
        cycle_time = t + timedelta(days=cycle_days)
        cycle_count = 0

        while cycle_time < now and cycle_count < 36:
            # Subscription cycled
            events.append(
                _evt(
                    SystemEventEnum.subscription_cycled,
                    cycle_time,
                    {
                        "subscription_id": fake_sub_id,
                        "product_id": str(chosen_product.id),
                        "amount": price_amount,
                        "currency": "usd",
                        "recurring_interval": str(interval),
                        "recurring_interval_count": 1,
                    },
                )
            )

            # Order paid for the cycle
            cycle_order_id = str(_generate_seed_uuid(rng))
            events.append(
                _evt(
                    SystemEventEnum.order_paid,
                    cycle_time + timedelta(seconds=rng.randint(1, 60)),
                    {
                        "order_id": cycle_order_id,
                        "product_id": str(chosen_product.id),
                        "amount": price_amount,
                        "currency": "usd",
                        "net_amount": int(price_amount * 0.95),
                        "tax_amount": int(price_amount * 0.05),
                        "subscription_id": fake_sub_id,
                        "recurring_interval": str(interval),
                        "recurring_interval_count": 1,
                    },
                )
            )

            # Benefit cycled
            events.append(
                _evt(
                    SystemEventEnum.benefit_cycled,
                    cycle_time + timedelta(seconds=rng.randint(1, 60)),
                    {
                        "benefit_id": fake_benefit_id,
                        "benefit_grant_id": fake_grant_id,
                        "benefit_type": "custom",
                    },
                )
            )

            cycle_time += timedelta(days=cycle_days)
            cycle_count += 1

        # 7. Some customers get interesting lifecycle events
        roll = rng.random()
        if roll < 0.15:
            # ~15% cancel then uncanceled
            cancel_time = t + timedelta(days=rng.randint(10, days_ago - 5))
            if cancel_time < now:
                events.append(
                    _evt(
                        SystemEventEnum.subscription_canceled,
                        cancel_time,
                        {
                            "subscription_id": fake_sub_id,
                            "product_id": str(chosen_product.id),
                            "amount": price_amount,
                            "currency": "usd",
                            "recurring_interval": str(interval),
                            "recurring_interval_count": 1,
                            "customer_cancellation_reason": "too_expensive",
                            "canceled_at": cancel_time.isoformat(),
                            "cancel_at_period_end": True,
                        },
                    )
                )
                # Then uncanceled a few days later
                uncancel_time = cancel_time + timedelta(days=rng.randint(1, 5))
                if uncancel_time < now:
                    events.append(
                        _evt(
                            SystemEventEnum.subscription_uncanceled,
                            uncancel_time,
                            {
                                "subscription_id": fake_sub_id,
                                "product_id": str(chosen_product.id),
                                "amount": price_amount,
                                "currency": "usd",
                                "recurring_interval": str(interval),
                                "recurring_interval_count": 1,
                            },
                        )
                    )
        elif roll < 0.30:
            # ~15% upgraded to a different product
            if len(recurring_products) > 1:
                other = rng.choice(
                    [p for p in recurring_products if p.id != chosen_product.id]
                )
                upgrade_time = t + timedelta(days=rng.randint(7, min(60, days_ago - 5)))
                if upgrade_time < now:
                    events.append(
                        _evt(
                            SystemEventEnum.subscription_product_updated,
                            upgrade_time,
                            {
                                "subscription_id": fake_sub_id,
                                "old_product_id": str(chosen_product.id),
                                "new_product_id": str(other.id),
                            },
                        )
                    )
        elif roll < 0.40:
            # ~10% got a refund on one order
            refund_time = t + timedelta(days=rng.randint(5, min(30, days_ago - 5)))
            if refund_time < now:
                events.append(
                    _evt(
                        SystemEventEnum.order_refunded,
                        refund_time,
                        {
                            "order_id": fake_order_id,
                            "refunded_amount": price_amount,
                            "currency": "usd",
                        },
                    )
                )
        elif roll < 0.50:
            # ~10% canceled for real
            cancel_time = t + timedelta(days=rng.randint(15, days_ago - 2))
            if cancel_time < now:
                events.append(
                    _evt(
                        SystemEventEnum.subscription_canceled,
                        cancel_time,
                        {
                            "subscription_id": fake_sub_id,
                            "product_id": str(chosen_product.id),
                            "amount": price_amount,
                            "currency": "usd",
                            "recurring_interval": str(interval),
                            "recurring_interval_count": 1,
                            "customer_cancellation_reason": "unused",
                            "customer_cancellation_comment": "Not using it enough",
                            "canceled_at": cancel_time.isoformat(),
                            "cancel_at_period_end": False,
                        },
                    )
                )

    # 8. Some customers also make one-time purchases
    if onetime_products and rng.random() < 0.4:
        otp = rng.choice(onetime_products)
        otp_time = timeline_start + timedelta(days=rng.randint(1, max(1, days_ago - 5)))
        if otp_time < now:
            otp_price = 4900
            for p in otp.all_prices:
                pa = getattr(p, "price_amount", None)
                if pa is not None:
                    otp_price = pa
                    break
            otp_order_id = str(_generate_seed_uuid(rng))
            events.append(
                _evt(
                    SystemEventEnum.checkout_created,
                    otp_time,
                    {
                        "checkout_id": str(_generate_seed_uuid(rng)),
                        "checkout_status": "succeeded",
                        "product_id": str(otp.id),
                    },
                )
            )
            events.append(
                _evt(
                    SystemEventEnum.order_paid,
                    otp_time + timedelta(minutes=rng.randint(1, 5)),
                    {
                        "order_id": otp_order_id,
                        "product_id": str(otp.id),
                        "amount": otp_price,
                        "currency": "usd",
                        "net_amount": int(otp_price * 0.95),
                        "tax_amount": int(otp_price * 0.05),
                    },
                )
            )

    # 9. Customer updated (some customers update their info)
    if rng.random() < 0.3:
        update_time = timeline_start + timedelta(
            days=rng.randint(2, max(2, days_ago - 2))
        )
        if update_time < now:
            events.append(
                _evt(
                    SystemEventEnum.customer_updated,
                    update_time,
                    {
                        "customer_id": str(customer_id),
                        "customer_email": customer_email,
                        "customer_name": customer_name,
                        "customer_external_id": None,
                        "updated_fields": {"name": customer_name},
                    },
                )
            )

    return events


def _build_user_cost_span_events(
    organization_id: Any,
    customer_id: Any,
    days_back: int = 90,
    rng: random.Random | None = None,
) -> list[dict[str, Any]]:
    """Generate user-event span hierarchies with _cost and _llm metadata.

    Models two span types:
    - Support flow: support_request → sentiment_analysis, draft_generated, email_sent, support_request_completed
    - Document flow: document_upload → document_process, s3_upload
    """
    events: list[dict[str, Any]] = []
    rng = rng or random.Random()
    now = datetime.now(UTC)

    llm_vendors = [
        {
            "vendor": "google",
            "model": "gemini-1.5-flash",
            "input_cost_per_m": 0.075,
            "output_cost_per_m": 0.30,
        },
        {
            "vendor": "google",
            "model": "gemini-1.5-pro",
            "input_cost_per_m": 3.50,
            "output_cost_per_m": 10.50,
        },
        {
            "vendor": "openai",
            "model": "gpt-4o-mini",
            "input_cost_per_m": 0.15,
            "output_cost_per_m": 0.60,
        },
        {
            "vendor": "openai",
            "model": "gpt-4o",
            "input_cost_per_m": 2.50,
            "output_cost_per_m": 10.00,
        },
        {
            "vendor": "anthropic",
            "model": "claude-3-5-haiku",
            "input_cost_per_m": 0.80,
            "output_cost_per_m": 4.00,
        },
    ]

    def _llm_child_event(
        name: str,
        parent_id: Any,
        timestamp: datetime,
        input_tokens: int,
        output_tokens: int,
        vendor_config: dict[str, Any],
        extra_metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        cost = (
            input_tokens / 1_000_000 * vendor_config["input_cost_per_m"]
            + output_tokens / 1_000_000 * vendor_config["output_cost_per_m"]
        )
        metadata: dict[str, Any] = {
            "_cost": {"amount": round(cost, 6), "currency": "usd"},
            "_llm": {
                "vendor": vendor_config["vendor"],
                "model": vendor_config["model"],
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "total_tokens": input_tokens + output_tokens,
            },
        }
        if extra_metadata:
            metadata.update(extra_metadata)
        return {
            "name": name,
            "source": "user",
            "timestamp": timestamp,
            "organization_id": organization_id,
            "customer_id": customer_id,
            "parent_id": parent_id,
            "user_metadata": metadata,
        }

    def _infra_child_event(
        name: str,
        parent_id: Any,
        timestamp: datetime,
        cost_amount: float,
        extra_metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        metadata: dict[str, Any] = {
            "_cost": {"amount": round(cost_amount, 6), "currency": "usd"},
        }
        if extra_metadata:
            metadata.update(extra_metadata)
        return {
            "name": name,
            "source": "user",
            "timestamp": timestamp,
            "organization_id": organization_id,
            "customer_id": customer_id,
            "parent_id": parent_id,
            "user_metadata": metadata,
        }

    def _no_cost_child_event(
        name: str,
        parent_id: Any,
        timestamp: datetime,
        extra_metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        return {
            "name": name,
            "source": "user",
            "timestamp": timestamp,
            "organization_id": organization_id,
            "customer_id": customer_id,
            "parent_id": parent_id,
            "user_metadata": extra_metadata or {},
        }

    def _root_event(
        name: str,
        span_id: Any,
        timestamp: datetime,
        extra_metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        return {
            "id": span_id,
            "external_id": str(span_id),
            "name": name,
            "source": "user",
            "timestamp": timestamp,
            "organization_id": organization_id,
            "customer_id": customer_id,
            "user_metadata": extra_metadata or {},
        }

    # Spread events across the past N days
    num_spans = rng.randint(10, 40)
    for _ in range(num_spans):
        offset_seconds = rng.randint(0, days_back * 86400)
        span_start = now - timedelta(seconds=offset_seconds)
        vendor = rng.choice(llm_vendors)
        span_type = rng.choice(["support", "document"])

        if span_type == "support":
            # Support request span:
            # support_request (root) → sentiment_analysis, draft_generated, email_sent, support_request_completed
            span_id = _generate_seed_uuid(rng)
            events.append(
                _root_event(
                    "support_request",
                    span_id,
                    span_start,
                    {
                        "ticket_id": str(_generate_seed_uuid(rng)),
                        "channel": rng.choice(["email", "chat", "api"]),
                    },
                )
            )

            t = span_start

            # sentiment_analysis child
            t += timedelta(seconds=rng.randint(1, 5))
            input_tokens = rng.randint(200, 1500)
            output_tokens = rng.randint(50, 300)
            events.append(
                _llm_child_event(
                    "sentiment_analysis",
                    span_id,
                    t,
                    input_tokens,
                    output_tokens,
                    vendor,
                    {
                        "sentiment": rng.choice(
                            ["positive", "neutral", "negative", "frustrated"]
                        )
                    },
                )
            )

            # draft_generated child
            t += timedelta(seconds=rng.randint(1, 10))
            input_tokens = rng.randint(500, 3000)
            output_tokens = rng.randint(200, 800)
            events.append(
                _llm_child_event(
                    "draft_generated",
                    span_id,
                    t,
                    input_tokens,
                    output_tokens,
                    vendor,
                )
            )

            # email_sent child (infra cost)
            t += timedelta(seconds=rng.randint(1, 3))
            events.append(
                _infra_child_event(
                    "email_sent",
                    span_id,
                    t,
                    cost_amount=0.000075,  # $0.075 per 1000 emails
                    extra_metadata={"provider": "sendgrid"},
                )
            )

            # support_request_completed child (no cost)
            t += timedelta(seconds=rng.randint(60, 3600))
            events.append(
                _no_cost_child_event(
                    "support_request_completed",
                    span_id,
                    t,
                    {"resolution": rng.choice(["resolved", "escalated", "closed"])},
                )
            )

        else:
            # Document processing span:
            # document_upload (root) → document_process, s3_upload
            span_id = _generate_seed_uuid(rng)
            doc_id = str(_generate_seed_uuid(rng))
            events.append(
                _root_event(
                    "document_upload",
                    span_id,
                    span_start,
                    {
                        "document_id": doc_id,
                        "filename": rng.choice(
                            ["report.pdf", "contract.docx", "data.csv", "spec.txt"]
                        ),
                        "size_bytes": rng.randint(5_000, 5_000_000),
                    },
                )
            )

            t = span_start

            # document_process child (LLM)
            t += timedelta(seconds=rng.randint(1, 10))
            input_tokens = rng.randint(1000, 8000)
            output_tokens = rng.randint(300, 2000)
            events.append(
                _llm_child_event(
                    "document_process",
                    span_id,
                    t,
                    input_tokens,
                    output_tokens,
                    vendor,
                    {
                        "document_id": doc_id,
                        "task": rng.choice(
                            ["summarize", "extract", "classify", "translate"]
                        ),
                    },
                )
            )

            # s3_upload child (infra cost)
            t += timedelta(seconds=rng.randint(1, 5))
            size_gb = rng.uniform(0.001, 0.05)
            events.append(
                _infra_child_event(
                    "s3_upload",
                    span_id,
                    t,
                    cost_amount=round(size_gb * 0.023, 8),  # $0.023 per GB
                    extra_metadata={
                        "document_id": doc_id,
                        "size_gb": round(size_gb, 6),
                    },
                )
            )

    return events


async def _seed_polar_self_billing_catalog(
    session: AsyncSession,
    organization: Organization,
    auth_subject: AuthSubject[User],
) -> None:
    """Materialize the Polar self-billing benefits and tier products in the DB."""
    benefits_by_description: dict[str, Benefit] = {}
    for benefit_data in POLAR_SELF_BENEFITS:
        description = benefit_data["description"]
        metadata = benefit_data["metadata"]
        assert isinstance(description, str)
        assert isinstance(metadata, dict)
        benefit = _create_seed_benefit(
            session,
            organization,
            BenefitFeatureFlagCreate(
                type=BenefitType.feature_flag,
                description=description,
                organization_id=organization.id,
                metadata=metadata,
                properties=BenefitFeatureFlagCreateProperties(),
            ),
        )
        benefits_by_description[description] = benefit

    for product_data in POLAR_SELF_PRODUCTS:
        name = product_data["name"]
        description = product_data.get("description")
        metadata = product_data["metadata"]
        price_amount = product_data["price_amount"]
        benefit_descriptions = product_data["benefits"]
        visibility_value = product_data.get("visibility")
        visibility = (
            Visibility(visibility_value)
            if isinstance(visibility_value, str)
            else Visibility.public
        )
        assert isinstance(name, str)
        assert description is None or isinstance(description, str)
        assert isinstance(metadata, dict)
        assert isinstance(benefit_descriptions, list)
        assert price_amount is None or isinstance(price_amount, int)

        price_create: ProductPriceFixedCreate
        price_create = ProductPriceFixedCreate(
            amount_type=ProductPriceAmountType.fixed,
            tax_behavior=TaxBehaviorOption.exclusive,
            price_amount=0 if price_amount is None else price_amount,
            price_currency=PresentmentCurrency.usd,
        )

        product = await product_service.create(
            session=session,
            create_schema=ProductCreateRecurring(
                name=name,
                description=description,
                organization_id=organization.id,
                recurring_interval=SubscriptionRecurringInterval.month,
                prices=[price_create],
                metadata=metadata,
                visibility=visibility,
            ),
            auth_subject=auth_subject,
            notify=False,
        )

        product.product_benefits = [
            ProductBenefit(
                benefit=benefits_by_description[benefit_description], order=order
            )
            for order, benefit_description in enumerate(benefit_descriptions)
        ]


async def _subscribe_seeded_orgs_to_polar_self(
    session: AsyncSession,
) -> int:
    """Add every other seeded org as a team customer of the Polar self org.

    The free plan is subscriptionless, so no Polar subscription is created here —
    customers default to the synthesized free plan until they pick a paid one.
    """
    polar_self_org = (
        await session.execute(
            select(Organization).where(Organization.slug == POLAR_ORG_SLUG)
        )
    ).scalar_one_or_none()
    if polar_self_org is None:
        return 0

    other_orgs = (
        (
            await session.execute(
                select(Organization)
                .where(
                    Organization.id != polar_self_org.id,
                    Organization.deleted_at.is_(None),
                    Organization.status != OrganizationStatus.BLOCKED,
                )
                .order_by(Organization.created_at)
            )
        )
        .scalars()
        .all()
    )

    subscribed = 0
    for organization in other_orgs:
        owner_row = (
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
            .unique()
            .first()
        )
        if owner_row is None:
            continue
        owner = owner_row[0]

        _create_seed_customer(
            session,
            polar_self_org,
            email=None,
            name=organization.name,
            customer_type=CustomerType.team,
            external_id=str(organization.id),
            owner_email=owner.email,
            owner_name=owner.public_name,
            owner_external_id=str(owner.id),
            created_at=organization.created_at,
        )
        subscribed += 1

    return subscribed


async def create_support_cases_seed(session: AsyncSession) -> None:
    """Seed one open review-appeal case and one open dispute case, so the
    backoffice Support Cases views have data to look at in development.

    Reuses the test fixtures to mint the order/payment/dispute the dispute case
    needs — the seed otherwise creates no orders.
    """
    save = save_fixture_factory(session)

    # -- Review appeal case --------------------------------------------------
    # Deny a seeded org and open a human-review appeal case, as if the AI had
    # rejected the appeal and the merchant escalated to a human.
    appeal_case_exists = await session.scalar(
        select(SupportCase.id)
        .join(Organization, Organization.id == SupportCase.organization_id)
        .join(SupportCaseMessage, SupportCaseMessage.case_id == SupportCase.id)
        .where(
            SupportCase.type == SupportCaseType.review_appeal,
            Organization.slug == "widget-industries",
            SupportCaseMessage.body == SEEDED_APPEAL_MESSAGE,
        )
        .limit(1)
    )
    appeal_org = None
    if appeal_case_exists is None:
        appeal_org = await session.scalar(
            select(Organization).where(Organization.slug == "widget-industries")
        )
    appeal_user = None
    if appeal_org is not None:
        appeal_user = (
            (
                await session.execute(
                    select(User)
                    .join(UserOrganization, UserOrganization.user_id == User.id)
                    .where(
                        UserOrganization.organization_id == appeal_org.id,
                        UserOrganization.deleted_at.is_(None),
                    )
                    .order_by(UserOrganization.created_at)
                    .limit(1)
                )
            )
            .unique()
            .scalar_one_or_none()
        )

    if appeal_org is not None and appeal_user is not None:
        reason = "We are a legitimate SaaS business — please review our appeal."
        appeal_org.set_status(OrganizationStatus.DENIED)
        session.add(appeal_org)
        # Repurpose the org's review if it already has one (one review per org).
        review = (
            await session.execute(
                select(OrganizationReview).where(
                    OrganizationReview.organization_id == appeal_org.id,
                    OrganizationReview.deleted_at.is_(None),
                )
            )
        ).unique().scalar_one_or_none() or OrganizationReview(
            organization_id=appeal_org.id
        )
        review.verdict = OrganizationReview.Verdict.FAIL
        review.risk_score = 88.0
        review.violated_sections = ["acceptable_use"]
        review.reason = "Automated review flagged the business for verification."
        review.timed_out = False
        review.model_used = "seed"
        review.validated_at = utc_now()
        review.organization_details_snapshot = {}
        review.appeal_submitted_at = utc_now()
        review.appeal_reason = reason
        review.appeal_reviewed_at = utc_now()
        review.appeal_decision = OrganizationReview.AppealDecision.REJECTED
        await save(review)
        if await appeal_case_service.get_case(session, review) is None:
            appeal_case = await appeal_case_service.request_human_review(
                session,
                review,
                organization=appeal_org,
                reason=reason,
                requested_by_user=appeal_user,
            )
            await support_case_service.post_message(
                session,
                appeal_case,
                author_kind=SupportCaseMessageAuthorKind.platform,
                body="Thanks for reaching out. Could you share your website and what you sell?",
                audience=[SupportCaseAudience.merchant],
            )
            await support_case_service.post_message(
                session,
                appeal_case,
                author_kind=SupportCaseMessageAuthorKind.merchant,
                author_user=appeal_user,
                body=SEEDED_APPEAL_MESSAGE,
                audience=[SupportCaseAudience.merchant],
            )
            print(f"Seeded review-appeal case on org '{appeal_org.slug}'")

    # -- Dispute case --------------------------------------------------------
    # Mint an order/payment/dispute from a seeded customer + product, then open
    # a dispute case awaiting the merchant's response.
    dispute_case_exists = await session.scalar(
        select(SupportCase.id)
        .join(Organization, Organization.id == SupportCase.organization_id)
        .join(SupportCaseMessage, SupportCaseMessage.case_id == SupportCase.id)
        .where(
            SupportCase.type == SupportCaseType.dispute,
            Organization.slug.in_(EXPECTED_ORGANIZATION_SLUGS),
            SupportCaseMessage.body == SEEDED_DISPUTE_MESSAGE,
        )
        .limit(1)
    )
    row = None
    if dispute_case_exists is None:
        row = (
            (
                await session.execute(
                    select(Customer, Product)
                    .join(Product, Product.organization_id == Customer.organization_id)
                    .join(Organization, Organization.id == Customer.organization_id)
                    .where(
                        Organization.slug == "acme-corp",
                        Customer.deleted_at.is_(None),
                        Product.deleted_at.is_(None),
                    )
                    .options(
                        joinedload(Customer.organization),
                        selectinload(Product.all_prices),
                    )
                    .order_by(
                        Customer.created_at,
                        Customer.id,
                        Product.created_at,
                        Product.id,
                    )
                    .limit(1)
                )
            )
            .unique()
            .first()
        )
    if row is not None:
        customer, product = row
        dispute_org = customer.organization
        order = await create_order(save, customer=customer, product=product)
        payment = await create_payment(save, dispute_org, order=order)
        dispute = await create_dispute(save, order, payment)
        dispute_case = await dispute_case_service.open_case(
            session, dispute, organization=dispute_org
        )
        await support_case_service.post_message(
            session,
            dispute_case,
            author_kind=SupportCaseMessageAuthorKind.merchant,
            body=SEEDED_DISPUTE_MESSAGE,
            audience=[SupportCaseAudience.merchant],
        )
        await support_case_service.post_message(
            session,
            dispute_case,
            author_kind=SupportCaseMessageAuthorKind.platform,
            body="Thanks — strong evidence. We've submitted it to the bank for you.",
            audience=[SupportCaseAudience.merchant],
        )
        await dispute_case_service.mark_under_review(session, dispute_case)
        print(f"Seeded dispute case on org '{dispute_org.slug}'")


async def _create_simple_fixture_graph(session: AsyncSession) -> None:
    """Create sample data for development and testing."""
    seed_rng = random.Random(SEED_RANDOM_SEED)

    # Organizations data
    orgs_data: list[OrganizationDict] = [
        {
            "name": "Acme Corporation",
            "slug": "acme-corp",
            "email": "contact@acme-corp.com",
            "website": "https://acme-corp.com",
            "bio": "Leading provider of innovative solutions for modern businesses.",
            "status": OrganizationStatus.ACTIVE,
            "feature_settings": {
                "compass_enabled": True,
            },
            "details": {
                "about": "We provide business intelligence dashboard",
                "switching": False,
                "switching_from": None,
                "product_description": "Our business intellignce dashboard are mostly monthly subscriptions, but our mobile app is accessible after a one-time payment.",
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
            "status": OrganizationStatus.ACTIVE,
            "details": {
                "about": "We make beautiful SQL management products for macOS.",
                "switching": False,
                "switching_from": None,
                "product_description": "The desktop apps that we create allows connecting to SQL databases, and performing queries on those databases.",
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
            "status": OrganizationStatus.ACTIVE,
            "details": {
                "about": "We're a hottest cloud provider since sliced bread",
                "switching": False,
                "switching_from": None,
                "product_description": "We sell ColdMail which provides an email inbox plus file storage. We also sell TemperateDocs which allows creating and editing documents online.",
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
            "status": OrganizationStatus.ACTIVE,
            "details": {
                "about": "We provide news in various formats",
                "switching": False,
                "switching_from": None,
                "product_description": "We send out our news products as emails daily and weekly",
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
            "status": OrganizationStatus.ACTIVE,
            "is_admin": True,
            "feature_settings": {
                "sso_enabled": True,
            },
            "sso_connection": {
                "name": "Local Mock SSO",
                "issuer": "http://localhost:8080/default",
                "client_id": "polar",
                "client_secret": "polar-secret",
            },
            "details": {
                "about": "Polar is an open source payment infrastructure platform for developers",
                "switching": False,
                "switching_from": None,
                "product_description": "SaaS platform for payment infrastructure",
                "previous_annual_revenue": 0,
            },
            "products": [
                {
                    "name": "Pro",
                    "description": "Monthly subscription to Pro features",
                    "price": 2000,
                    "recurring": SubscriptionRecurringInterval.month,
                },
            ],
        },
        {
            "name": "Polar",
            "slug": "polar",
            "email": "admin@polar.sh",
            "website": "https://polar.sh",
            "bio": "Open source payment infrastructure for developers",
            "status": OrganizationStatus.ACTIVE,
            "details": {
                "about": "Polar is an open source payment infrastructure platform for developers",
                "switching": False,
                "switching_from": None,
                "product_description": "SaaS platform with usage-based billing for event ingestion",
                "previous_annual_revenue": 0,
            },
            "feature_settings": {
                "seat_based_pricing_enabled": True,
                "member_model_enabled": True,
            },
            "customer_email_settings": {
                "order_confirmation": False,
                "payment_method_expiration_reminder": False,
                "subscription_cancellation": False,
                "subscription_confirmation": False,
                "subscription_cycled": False,
                "subscription_cycled_after_trial": False,
                "subscription_past_due": False,
                "subscription_renewal_reminder": False,
                "subscription_revoked": False,
                "subscription_trial_conversion_reminder": False,
                "subscription_uncanceled": False,
                "subscription_updated": False,
                "subscription_paused": False,
                "subscription_resumed": False,
            },
            "products": [],
        },
        {
            "name": "SeatBased Members Corp",
            "slug": "seatbased-members-corp",
            "email": "admin@polar.sh",
            "website": "https://seatbased-members.com",
            "bio": "Organization with seat-based pricing and members model enabled",
            "status": OrganizationStatus.ACTIVE,
            "details": {
                "about": "Testing seat-based pricing with members model",
                "switching": False,
                "switching_from": None,
                "product_description": "Team software licenses with per-seat billing",
                "previous_annual_revenue": 0,
            },
            "feature_settings": {
                "seat_based_pricing_enabled": True,
                "member_model_enabled": True,
            },
            "products": [
                {
                    "name": "Team Plan",
                    "description": "Per-seat team plan with member management",
                    "recurring": SubscriptionRecurringInterval.month,
                    "seat_based": True,
                    "price_per_seat": 1000,  # $10 per seat
                },
            ],
            "seat_based_customers": [
                {
                    "email": "customer-with-members@polar.sh",
                    "name": "Customer With Members Inc",
                    "seats_purchased": 5,
                    "seats_allocated": 2,
                },
            ],
        },
        {
            "name": "SeatBased Only Corp",
            "slug": "seatbased-only-corp",
            "email": "admin@polar.sh",
            "website": "https://seatbased-only.com",
            "bio": "Organization with seat-based pricing but members model disabled",
            "status": OrganizationStatus.ACTIVE,
            "details": {
                "about": "Testing seat-based pricing without members model",
                "switching": False,
                "switching_from": None,
                "product_description": "Team software licenses with simple seat billing",
                "previous_annual_revenue": 0,
            },
            "feature_settings": {
                "seat_based_pricing_enabled": True,
                "member_model_enabled": False,
            },
            "products": [
                {
                    "name": "Simple Team Plan",
                    "description": "Per-seat team plan without member management",
                    "recurring": SubscriptionRecurringInterval.month,
                    "seat_based": True,
                    "price_per_seat": 1500,  # $15 per seat
                },
            ],
            "seat_based_customers": [
                {
                    "email": "customer-no-members@polar.sh",
                    "name": "Customer Without Members Inc",
                    "seats_purchased": 5,
                    "seats_allocated": 2,
                },
            ],
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
        # Get or create user (allows multiple orgs to share the same user)
        user, _created = await user_service.get_by_email_or_create(
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
        organization.details = org_data.get("details", {})
        organization.details_submitted_at = utc_now()
        organization.set_status(org_data.get("status", OrganizationStatus.CREATED))
        organization.feature_settings = org_data.get("feature_settings", {})
        if "customer_email_settings" in org_data:
            organization.customer_email_settings = org_data["customer_email_settings"]
        session.add(organization)

        # Seed an enabled SSO connection pointing at the local mock OIDC IdP.
        # Written directly so the http:// mock issuer bypasses the HttpsUrl schema.
        sso_connection_data = org_data.get("sso_connection")
        if sso_connection_data is not None:
            session.add(
                OrganizationSSOConnection(
                    organization=organization,
                    name=sso_connection_data["name"],
                    type=OrganizationSSOConnectionType.oidc,
                    configuration={
                        "issuer": sso_connection_data["issuer"],
                        "client_id": sso_connection_data["client_id"],
                        "client_secret": sso_connection_data["client_secret"],
                        "auth_method": "client_secret",
                    },
                    enabled=True,
                )
            )

        # Attach a fake payout account so seeded orgs are payout-ready
        await create_fake_payout_account(session, organization, user)

        # Create OrganizationReview with PASS verdict for ACTIVE organizations
        if organization.status == OrganizationStatus.ACTIVE:
            organization.initially_reviewed_at = utc_now()
            organization_review = OrganizationReview(
                organization_id=organization.id,
                verdict=OrganizationReview.Verdict.PASS,
                risk_score=0.0,
                violated_sections=[],
                reason="Seed data - automatically approved",
                timed_out=False,
                model_used="seed",
                validated_at=utc_now(),
                organization_details_snapshot=org_data.get("details", {}),
            )
            session.add(organization_review)

        # Create benefits for organization
        org_benefits = {}
        for key, benefit_data in org_data.get("benefits", {}).items():
            benefit_schema_dict: Any = benefit_data.copy()
            benefit_schema_dict["organization_id"] = organization.id

            if benefit_data["type"] == BenefitType.downloadables:
                file_ids = []
                for file_data in benefit_data["properties"]["files"]:
                    instance = File(
                        id=generate_uuid(),
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

                    file_ids.append(instance.id)
                benefit_schema_dict["properties"]["files"] = file_ids

            benefit = _create_seed_benefit(
                session,
                organization,
                create_benefit_schema(benefit_schema_dict),
            )
            org_benefits[key] = benefit

        # Create meter for ColdMail organization
        coldmail_meter = None
        if org_data["slug"] == "coldmail":
            coldmail_meter = Meter(
                id=generate_uuid(),
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
                organization=organization,
            )
            session.add(coldmail_meter)

        # Create meter for Polar organization
        if org_data["slug"] == "polar":
            session.add(
                Meter(
                    id=generate_uuid(),
                    name="Events Ingested",
                    filter=Filter(
                        conjunction=FilterConjunction.and_,
                        clauses=[
                            FilterClause(
                                property="name",
                                operator=FilterOperator.eq,
                                value="events_ingested",
                            )
                        ],
                    ),
                    aggregation=CountAggregation(),
                    organization=organization,
                ),
            )

            await _seed_polar_self_billing_catalog(
                session=session,
                organization=organization,
                auth_subject=auth_subject,
            )
            organization.subscription_settings = {
                **organization.subscription_settings,
                "proration_behavior": SubscriptionProrationBehavior.invoice,
            }
            session.add(organization)

        # Create products for organization
        org_products = []
        seat_based_product = None
        seat_based_price = None
        for product_data in org_data.get("products", []):
            # Handle different price types
            price_create: (
                ProductPriceMeteredUnitCreate
                | ProductPriceFixedCreate
                | ProductPriceSeatBasedCreate
            )
            if product_data.get("metered", False) and coldmail_meter:
                price_create = ProductPriceMeteredUnitCreate(
                    amount_type=ProductPriceAmountType.metered_unit,
                    price_currency=PresentmentCurrency.usd,
                    tax_behavior=TaxBehaviorOption.exclusive,
                    unit_amount=Decimal(str(product_data["unit_amount"])),
                    meter_id=coldmail_meter.id,
                    cap_amount=product_data.get("cap_amount"),
                )
            elif product_data.get("seat_based", False):
                # Create seat-based price with a single tier
                price_per_seat = product_data.get("price_per_seat", 1000)
                price_create = ProductPriceSeatBasedCreate(
                    amount_type=ProductPriceAmountType.seat_based,
                    price_currency=PresentmentCurrency.usd,
                    tax_behavior=TaxBehaviorOption.exclusive,
                    seat_tiers=ProductPriceSeatTiers(
                        tiers=[
                            ProductPriceSeatTier(
                                min_seats=1,
                                max_seats=None,  # Unlimited
                                price_per_seat=price_per_seat,
                            )
                        ]
                    ),
                )
            else:
                # Create fixed price for product
                price_create = ProductPriceFixedCreate(
                    amount_type=ProductPriceAmountType.fixed,
                    tax_behavior=TaxBehaviorOption.exclusive,
                    price_amount=product_data["price"],
                    price_currency=PresentmentCurrency.usd,
                )

            product_create: ProductCreate
            recurring_interval = product_data.get("recurring", None)
            if recurring_interval is None:
                product_create = ProductCreateOneTime(
                    name=product_data["name"],
                    description=product_data["description"],
                    organization_id=organization.id,
                    prices=[price_create],
                )
            else:
                product_create = ProductCreateRecurring(
                    name=product_data["name"],
                    description=product_data["description"],
                    organization_id=organization.id,
                    recurring_interval=recurring_interval,
                    prices=[price_create],
                )

            product = await product_service.create(
                session=session,
                create_schema=product_create,
                auth_subject=auth_subject,
                notify=False,
            )
            org_products.append(product)

            # Track seat-based product for later subscription creation
            if product_data.get("seat_based", False):
                seat_based_product = product
                await session.refresh(product, ["all_prices"])
                for price in product.all_prices:
                    if isinstance(price, ProductPriceSeatUnit):
                        seat_based_price = price
                        break

            selected_benefits = product_data.get("benefits", [])
            if selected_benefits:
                product.product_benefits = [
                    ProductBenefit(benefit=org_benefits[key], order=order)
                    for order, key in enumerate(selected_benefits)
                ]

        # Create CheckoutLink with all products
        if org_products:
            checkout_links = [
                CheckoutLink(
                    payment_processor=PaymentProcessor.stripe,
                    client_secret=generate_token(prefix="polar_cl_"),
                    organization=organization,
                    label=f"{org_data['name']} store",
                    allow_discount_codes=True,
                    checkout_link_products=[
                        CheckoutLinkProduct(product=product, order=order)
                        for order, product in enumerate(org_products)
                    ],
                )
            ]

            if org_data["slug"] == "acme-corp":
                checkout_links.append(
                    CheckoutLink(
                        payment_processor=PaymentProcessor.stripe,
                        client_secret="polar_cl_e2e_seed_checkout_link_subscription",
                        organization=organization,
                        label="E2E test checkout",
                        allow_discount_codes=True,
                        checkout_link_products=[
                            CheckoutLinkProduct(product=product, order=order)
                            for order, product in enumerate(org_products)
                        ],
                    )
                )
            session.add_all(checkout_links)

        if org_products:
            session.add(
                DiscountPercentage(
                    name="Free",
                    code="free",
                    basis_points=10000,
                    duration=DiscountDuration.once,
                    organization=organization,
                )
            )

        # Create customers for organization (skip if seat_based_customers are defined)
        num_customers = (
            seed_rng.randint(3, 8) if not org_data.get("seat_based_customers") else 0
        )
        seeded_customers = []
        for i in range(num_customers):
            # customer_email = f"customer_{org_data['slug']}_{i + 1}@example.com"
            customer_email = f"customer_{org_data['slug']}_{i + 1}@polar.sh"
            customer = _create_seed_customer(
                session,
                organization,
                email=customer_email,
                name=f"Customer {i + 1}",
            )
            seeded_customers.append(customer)

        # Create real Subscription rows for acme-corp customers so that PG-based
        # metrics (MRR, Trial MRR, Active Subscriptions) have data to display.
        # Mixes active and trialing subscriptions to populate trial metrics too.
        if org_data["slug"] == "acme-corp" and seeded_customers:
            recurring_products = [
                p for p in org_products if p.recurring_interval is not None
            ]
            if recurring_products:
                now = utc_now()
                for idx, sub_customer in enumerate(seeded_customers):
                    product = recurring_products[idx % len(recurring_products)]
                    fixed_price = next(
                        (
                            price
                            for price in product.all_prices
                            if isinstance(price, ProductPriceFixed)
                        ),
                        None,
                    )
                    if fixed_price is None:
                        continue

                    is_trial = idx % 3 == 0
                    trial_end = now + timedelta(days=14) if is_trial else None
                    status = (
                        SubscriptionStatus.trialing
                        if is_trial
                        else SubscriptionStatus.active
                    )

                    subscription = Subscription(
                        id=generate_uuid(),
                        amount=fixed_price.price_amount,
                        net_amount=fixed_price.price_amount,
                        currency=fixed_price.price_currency,
                        tax_behavior=TaxBehavior.exclusive,
                        recurring_interval=product.recurring_interval,
                        recurring_interval_count=1,
                        status=status,
                        current_period_start=now,
                        current_period_end=now + timedelta(days=30),
                        trial_start=now if is_trial else None,
                        trial_end=trial_end,
                        cancel_at_period_end=False,
                        started_at=now,
                        customer_id=sub_customer.id,
                        organization_id=product.organization_id,
                        product_id=product.id,
                        anchor_day=now.day,
                    )
                    session.add(subscription)

                    spp = SubscriptionProductPrice(
                        subscription_id=subscription.id,
                        product_price_id=fixed_price.id,
                        amount=fixed_price.price_amount,
                    )
                    session.add(spp)

                await session.flush()

        # Create seat-based customers with subscriptions and seats
        seat_based_customers = org_data.get("seat_based_customers", [])
        if seat_based_customers and seat_based_product and seat_based_price:
            member_model_enabled = org_data.get("feature_settings", {}).get(
                "member_model_enabled", False
            )

            for customer_data in seat_based_customers:
                # Create the customer
                seat_customer = _create_seed_customer(
                    session,
                    organization,
                    email=customer_data["email"],
                    name=customer_data["name"],
                )

                seats_purchased = customer_data["seats_purchased"]
                seats_allocated = customer_data["seats_allocated"]

                # Create subscription with seats
                amount = seat_based_price.calculate_amount(seats_purchased)
                subscription = Subscription(
                    amount=amount,
                    net_amount=amount,
                    currency=seat_based_price.price_currency,
                    tax_behavior=TaxBehavior.exclusive,
                    recurring_interval=seat_based_product.recurring_interval,
                    recurring_interval_count=1,
                    status=SubscriptionStatus.active,
                    current_period_start=utc_now(),
                    current_period_end=utc_now() + timedelta(days=30),
                    cancel_at_period_end=False,
                    started_at=utc_now(),
                    customer_id=seat_customer.id,
                    organization_id=seat_based_product.organization_id,
                    product_id=seat_based_product.id,
                    seats=seats_purchased,
                    anchor_day=utc_now().day,
                )
                session.add(subscription)
                await session.flush()

                # Create subscription product price
                spp = SubscriptionProductPrice(
                    subscription_id=subscription.id,
                    product_price_id=seat_based_price.id,
                    amount=amount,
                )
                session.add(spp)
                await session.flush()

                # Create members if member_model_enabled
                members_for_seats = []
                if member_model_enabled:
                    members_for_seats.append(seat_customer.members[0])

                    # Create additional members for allocated seats (beyond the owner)
                    for i in range(1, seats_allocated):
                        member = Member(
                            customer_id=seat_customer.id,
                            organization_id=organization.id,
                            email=f"member{i}@{customer_data['email'].split('@')[1]}",
                            name=f"Team Member {i}",
                            role=MemberRole.member,
                        )
                        session.add(member)
                        await session.flush()
                        members_for_seats.append(member)

                # Create customer seats
                for i in range(seats_purchased):
                    if i < seats_allocated:
                        # Allocated/claimed seats
                        if member_model_enabled and i < len(members_for_seats):
                            # With member - claimed
                            seat = CustomerSeat(
                                subscription=subscription,
                                status=SeatStatus.claimed,
                                customer=seat_customer,
                                member=members_for_seats[i],
                                email=members_for_seats[i].email,
                                claimed_at=utc_now(),
                            )
                        else:
                            # Without member model - create a Customer for each seat holder
                            seat_holder_email = (
                                f"seat{i + 1}@{customer_data['email'].split('@')[1]}"
                            )
                            seat_holder_customer = _create_seed_customer(
                                session,
                                organization,
                                email=seat_holder_email,
                                name=f"Seat Holder {i + 1}",
                            )
                            seat = CustomerSeat(
                                subscription=subscription,
                                status=SeatStatus.claimed,
                                customer=seat_holder_customer,
                                email=seat_holder_email,
                                claimed_at=utc_now(),
                            )
                    else:
                        # Pending seats (not yet allocated)
                        seat = CustomerSeat(
                            subscription=subscription,
                            status=SeatStatus.pending,
                            customer=seat_customer,
                        )
                    session.add(seat)

                await session.flush()

        # Downgrade user from admin (for non-admin users)
        # Preserve admin status if already granted by a previous organization
        await user_repository.update(
            user,
            update_dict={"is_admin": user.is_admin or org_data.get("is_admin", False)},
        )

    subscribed = await _subscribe_seeded_orgs_to_polar_self(session)
    if subscribed:
        print(f"Subscribed {subscribed} organization(s) to the Polar self free plan")


async def _get_seeded_organizations(
    session: AsyncSession,
) -> dict[str, Organization]:
    organizations = (
        (
            await session.execute(
                select(Organization).where(
                    Organization.slug.in_(EXPECTED_ORGANIZATION_SLUGS)
                )
            )
        )
        .scalars()
        .all()
    )
    return {organization.slug: organization for organization in organizations}


async def _simple_seed_is_complete(session: AsyncSession) -> bool:
    organizations = await _get_seeded_organizations(session)
    if not organizations:
        return False
    if set(organizations) != EXPECTED_ORGANIZATION_SLUGS:
        raise RuntimeError("Simple seed found a partial organization fixture set")

    acme = organizations["acme-corp"]
    sentinel_customer_id = await session.scalar(
        select(Customer.id).where(
            Customer.organization_id == acme.id,
            Customer.email == "customer_acme-corp_1@polar.sh",
            Customer.deleted_at.is_(None),
        )
    )
    if sentinel_customer_id is None:
        raise RuntimeError("Simple seed found an incomplete Acme fixture set")
    return True


async def create_simple_seed_data(session: AsyncSession, redis: Redis) -> bool:
    if await _simple_seed_is_complete(session):
        print(
            "seed.phase.simple status=complete action=skip "
            f"organizations={len(EXPECTED_ORGANIZATION_SLUGS)}"
        )
        return False

    started_at = monotonic()
    print("seed.phase.simple status=pending")
    try:
        await _create_simple_fixture_graph(session)
        await session.commit()
    except Exception:
        await session.rollback()
        print(
            "seed.phase.simple status=failure "
            f"elapsed_seconds={monotonic() - started_at:.2f}"
        )
        raise
    print(
        "seed.phase.simple status=success "
        f"organizations={len(EXPECTED_ORGANIZATION_SLUGS)} "
        f"elapsed_seconds={monotonic() - started_at:.2f}"
    )
    return True


def _namespace_simple_complement_events(
    events: list[dict[str, Any]], organization: Organization, customer: Customer
) -> None:
    id_mapping: dict[UUID, UUID] = {}
    for index, event in enumerate(events):
        event_id = uuid5(
            NAMESPACE_URL,
            f"{SIMPLE_COMPLEMENT_EVENT_PREFIX}{organization.slug}:{customer.id}:{index}",
        )
        previous_id = event.get("id")
        if isinstance(previous_id, UUID):
            id_mapping[previous_id] = event_id
        event["id"] = event_id
        event["external_id"] = (
            f"{SIMPLE_COMPLEMENT_EVENT_PREFIX}{organization.slug}:{customer.id}:{index}"
        )

    for event in events:
        parent_id = event.get("parent_id")
        if isinstance(parent_id, UUID) and parent_id in id_mapping:
            event["parent_id"] = id_mapping[parent_id]


async def _delete_simple_complement_tinybird_events() -> int:
    if settings.TINYBIRD_API_TOKEN is None:
        return 0

    result = await tinybird_client.delete(
        DATASOURCE_EVENTS,
        f"startsWith(external_id, '{SIMPLE_COMPLEMENT_EVENT_NAMESPACE}')",
    )
    job_id = result.get("job_id")
    if job_id is None:
        return int(result.get("rows_affected", 0))

    deadline = monotonic() + 300
    while monotonic() < deadline:
        job = await tinybird_client.get_job(str(job_id))
        status = job.get("status")
        if status == "done":
            return int(job.get("rows_affected", 0))
        if status == "error":
            raise RuntimeError(
                f"Tinybird seed cleanup failed: {job.get('error', 'unknown error')}"
            )
        await asyncio.sleep(0.25)
    raise TimeoutError("Timed out waiting for Tinybird seed cleanup")


async def _simple_complement_seed_is_complete(session: AsyncSession) -> bool:
    # The phase commits its events and deferred PostgreSQL fixtures together,
    # after Tinybird ingestion succeeds.
    namespaced_event_id = await session.scalar(
        select(EventModel.id)
        .where(
            EventModel.external_id.startswith(
                SIMPLE_COMPLEMENT_EVENT_PREFIX, autoescape=True
            )
        )
        .limit(1)
    )
    if namespaced_event_id is not None:
        return True
    if SIMPLE_COMPLEMENT_SEED_VERSION != "v1":
        return False

    acme = await session.scalar(
        select(Organization).where(Organization.slug == "acme-corp")
    )
    if acme is None:
        return False

    legacy_compass_customer_count = await session.scalar(
        select(func.count(Customer.id)).where(
            Customer.organization_id == acme.id,
            Customer.email.like(r"compass\_%@acme-corp.com", escape="\\"),
            Customer.deleted_at.is_(None),
        )
    )
    return legacy_compass_customer_count == 18


async def _create_simple_complement_event_history(
    session: AsyncSession, organizations: Sequence[Organization]
) -> int:
    organization_ids = {organization.id for organization in organizations}
    products = (
        (
            await session.execute(
                select(Product)
                .where(Product.organization_id.in_(organization_ids))
                .options(selectinload(Product.all_prices))
            )
        )
        .scalars()
        .all()
    )
    products_by_organization: dict[UUID, list[Product]] = {}
    for product in sorted(
        products,
        key=lambda item: (
            str(item.organization_id),
            item.name,
            item.recurring_interval or "",
            str(item.id),
        ),
    ):
        products_by_organization.setdefault(product.organization_id, []).append(product)

    customers = (
        (
            await session.execute(
                select(Customer).where(
                    Customer.organization_id.in_(organization_ids),
                    Customer.email.like(r"customer\_%@polar.sh", escape="\\"),
                    Customer.deleted_at.is_(None),
                )
            )
        )
        .scalars()
        .all()
    )
    customers_by_organization: dict[UUID, list[Customer]] = {}
    for customer in customers:
        customers_by_organization.setdefault(customer.organization_id, []).append(
            customer
        )

    event_repository = EventRepository.from_session(session)
    event_count = 0
    seed_rng = random.Random(SEED_RANDOM_SEED)
    for organization in sorted(organizations, key=lambda item: item.slug):
        pending_events: list[dict[str, Any]] = []
        organization_products = products_by_organization.get(organization.id, [])
        organization_customers = sorted(
            customers_by_organization.get(organization.id, []),
            key=lambda item: item.email or "",
        )
        for customer_index, customer in enumerate(organization_customers):
            assert customer.email is not None
            customer_events = _build_customer_timeline_events(
                organization_id=organization.id,
                customer_id=customer.id,
                customer_email=customer.email,
                customer_name=customer.name or customer.email,
                products=organization_products,
                rng=seed_rng,
            )
            if organization.slug == "coldmail" and customer_index == 0:
                base_time = datetime.now(UTC) - timedelta(days=30)
                for day in range(30):
                    for _ in range(seed_rng.randint(1, 10)):
                        customer_events.append(
                            {
                                "name": "email_sent",
                                "source": "user",
                                "timestamp": base_time
                                + timedelta(
                                    days=day,
                                    hours=seed_rng.randint(0, 23),
                                    minutes=seed_rng.randint(0, 59),
                                ),
                                "organization_id": organization.id,
                                "customer_id": customer.id,
                                "user_metadata": {
                                    "type": "email_sent",
                                    "recipient": f"user{seed_rng.randint(1, 100)}@example.com",
                                    "subject": f"Email subject {seed_rng.randint(1, 1000)}",
                                },
                            }
                        )
            customer_events.extend(
                _build_user_cost_span_events(
                    organization_id=organization.id,
                    customer_id=customer.id,
                    rng=seed_rng,
                )
            )
            _namespace_simple_complement_events(customer_events, organization, customer)
            pending_events.extend(customer_events)

        if not pending_events:
            continue
        _normalize_seed_event_batch(pending_events)
        await _stamp_event_type_ids(session, pending_events)
        event_ids, _ = await event_repository.insert_batch(
            pending_events, render_nulls=True
        )
        inserted = await event_repository.get_all(
            select(EventModel).where(EventModel.id.in_(event_ids))
        )
        await event_service._create_meter_events(session, inserted)
        ancestors_by_event = await event_repository.get_ancestors_batch(event_ids)
        await _flush_tinybird_events(inserted, ancestors_by_event)
        event_count += len(event_ids)

    return event_count


async def _create_compass_seed(session: AsyncSession, acme: Organization) -> None:
    existing_customer_count = await session.scalar(
        select(func.count(Customer.id)).where(
            Customer.organization_id == acme.id,
            Customer.email.like(r"compass\_%@acme-corp.com", escape="\\"),
            Customer.deleted_at.is_(None),
        )
    )
    if existing_customer_count == 18:
        return
    if existing_customer_count:
        raise RuntimeError("Simple-complement seed found a partial Compass fixture set")

    product = await session.scalar(
        select(Product)
        .where(
            Product.organization_id == acme.id,
            Product.name == "Premium Business Suite",
            Product.deleted_at.is_(None),
        )
        .options(selectinload(Product.all_prices))
    )
    if product is None:
        raise RuntimeError("Compass seed requires the Premium Business Suite product")
    price = next(
        (price for price in product.all_prices if isinstance(price, ProductPriceFixed)),
        None,
    )
    if price is None:
        raise RuntimeError("Compass seed requires a fixed product price")

    auth_subject = AuthSubject(subject=acme, scopes=set(), session=None)
    now = utc_now()
    cohorts: tuple[tuple[str, int, int, SubscriptionStatus, int | None], ...] = (
        ("base", 6, 45, SubscriptionStatus.active, None),
        ("growth", 4, 10, SubscriptionStatus.active, None),
        ("churn", 3, 65, SubscriptionStatus.canceled, 12),
        ("trial", 5, 4, SubscriptionStatus.trialing, None),
    )
    sequence = 0
    for label, count, started_ago, status, ended_ago in cohorts:
        for _ in range(count):
            sequence += 1
            started_at = now - timedelta(days=started_ago)
            ended_at = now - timedelta(days=ended_ago) if ended_ago else None
            amount = (
                price.price_amount // 2 if label == "growth" else price.price_amount
            )
            customer = await customer_service.create(
                session=session,
                customer_create=CustomerIndividualCreate(
                    email=f"compass_{sequence}@acme-corp.com",
                    name=f"Compass Customer {sequence}",
                    organization_id=None,
                ),
                auth_subject=auth_subject,
            )
            subscription = Subscription(
                id=generate_uuid(),
                amount=amount,
                net_amount=amount,
                currency=price.price_currency,
                tax_behavior=TaxBehavior.exclusive,
                recurring_interval=product.recurring_interval,
                recurring_interval_count=1,
                status=status,
                current_period_start=started_at,
                current_period_end=ended_at or now + timedelta(days=30),
                cancel_at_period_end=False,
                started_at=started_at,
                ended_at=ended_at,
                ends_at=ended_at,
                canceled_at=ended_at,
                trial_end=(now + timedelta(days=10) if label == "trial" else None),
                customer=customer,
                organization=acme,
                product=product,
                anchor_day=started_at.day,
                subscription_product_prices=[
                    SubscriptionProductPrice(
                        product_price=price,
                        amount=amount,
                    )
                ],
            )
            session.add(subscription)

    for label, day_range, total, succeeded in (
        ("prior", range(35, 55), 20, 16),
        ("recent", range(3, 23), 20, 11),
    ):
        offsets = list(day_range)
        for index in range(total):
            opened_at = now - timedelta(days=offsets[index % len(offsets)])
            session.add(
                Checkout(
                    id=generate_uuid(),
                    payment_processor=PaymentProcessor.stripe,
                    status=(
                        CheckoutStatus.succeeded
                        if index < succeeded
                        else CheckoutStatus.expired
                    ),
                    client_secret=generate_token(prefix="polar_c_"),
                    expires_at=opened_at + timedelta(days=1),
                    created_at=opened_at,
                    allow_discount_codes=True,
                    require_billing_address=False,
                    is_business_customer=False,
                    amount=price.price_amount,
                    net_amount=price.price_amount,
                    currency=price.price_currency,
                    organization=acme,
                    analytics_metadata={
                        "opened_at": opened_at.isoformat(),
                        "seed": (f"compass:{SIMPLE_COMPLEMENT_SEED_VERSION}:{label}"),
                    },
                    checkout_products=[CheckoutProduct(product=product, order=0)],
                )
            )


async def create_simple_complement_seed_data(session: AsyncSession) -> bool:
    if not await _simple_seed_is_complete(session):
        raise RuntimeError("Simple-complement seed requires the simple seed phase")
    if await _simple_complement_seed_is_complete(session):
        print(
            "seed.phase.simple_complement status=complete action=skip "
            f"version={SIMPLE_COMPLEMENT_SEED_VERSION}"
        )
        return False

    started_at = monotonic()
    print(
        "seed.phase.simple_complement status=pending "
        f"version={SIMPLE_COMPLEMENT_SEED_VERSION}"
    )
    try:
        tinybird_deleted = await _delete_simple_complement_tinybird_events()
        result = await session.execute(
            delete(EventModel).where(
                EventModel.external_id.startswith(
                    SIMPLE_COMPLEMENT_EVENT_NAMESPACE, autoescape=True
                )
            )
        )
        postgres_deleted = max(getattr(result, "rowcount", 0) or 0, 0)
        organizations = await _get_seeded_organizations(session)
        acme = organizations["acme-corp"]
        event_count = await _create_simple_complement_event_history(
            session, list(organizations.values())
        )
        await _create_compass_seed(session, acme)
        await create_support_cases_seed(session)
        await session.commit()
    except Exception:
        await session.rollback()
        print(
            "seed.phase.simple_complement status=failure "
            f"version={SIMPLE_COMPLEMENT_SEED_VERSION} "
            f"elapsed_seconds={monotonic() - started_at:.2f}"
        )
        raise

    print(
        "seed.phase.simple_complement status=success "
        f"version={SIMPLE_COMPLEMENT_SEED_VERSION} "
        f"elapsed_seconds={monotonic() - started_at:.2f} "
        f"events={event_count} postgres_deleted={postgres_deleted} "
        f"tinybird_deleted={tinybird_deleted}"
    )
    return True


async def create_seed_data(session: AsyncSession, redis: Redis) -> None:
    started_at = monotonic()
    print("seed.phase.all status=pending")
    simple_created = await create_simple_seed_data(session, redis)
    simple_complement_created = await create_simple_complement_seed_data(session)
    if not simple_created and not simple_complement_created:
        raise typer.Exit(2)
    print(
        f"seed.phase.all status=success elapsed_seconds={monotonic() - started_at:.2f}"
    )


POLAR_ORG_SLUG = "polar"
TOKEN_COMMENT = "Polar self-integration (dev seed)"
TOKEN_SCOPE_VALUES = (
    Scope.customers_read,
    Scope.customers_write,
    Scope.customer_sessions_write,
    Scope.subscriptions_write,
    Scope.events_write,
    Scope.members_read,
    Scope.members_write,
    Scope.products_read,
    Scope.checkouts_write,
    Scope.benefits_read,
    # Startup Program: claim flow creates/reads the per-customer
    # discount via SDK and reads/updates the resulting subscription's
    # discount + matching orders.
    Scope.discounts_read,
    Scope.discounts_write,
    Scope.orders_read,
    Scope.orders_write,
)
TOKEN_SCOPES = " ".join(TOKEN_SCOPE_VALUES)

WEBHOOK_NAME = "Polar self-integration (dev seed)"
WEBHOOK_URL = "http://127.0.0.1:8000/v1/integrations/polar/webhook"
WEBHOOK_EVENTS: list[WebhookEventType] = [
    WebhookEventType.benefit_grant_created,
    WebhookEventType.benefit_grant_updated,
    WebhookEventType.benefit_grant_revoked,
    WebhookEventType.subscription_revoked,
    WebhookEventType.order_created,
]
SERVER_ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
WEBHOOK_SECRET_ENV_KEY = "POLAR_POLAR_WEBHOOK_SECRET"
SCALE_PRODUCT_NAME = str(POLAR_SELF_PRODUCTS[-1]["name"])


def _write_webhook_secret_to_env(secret: str) -> None:
    if not SERVER_ENV_PATH.exists():
        print(
            f"# warn: {SERVER_ENV_PATH} not found; "
            f"skipping {WEBHOOK_SECRET_ENV_KEY} write"
        )
        return

    lines = SERVER_ENV_PATH.read_text().splitlines(keepends=True)
    new_line = f'{WEBHOOK_SECRET_ENV_KEY}="{secret}"\n'
    replaced = False
    for i, line in enumerate(lines):
        if line.startswith(f"{WEBHOOK_SECRET_ENV_KEY}="):
            lines[i] = new_line
            replaced = True
            break

    if not replaced:
        if lines and not lines[-1].endswith("\n"):
            lines[-1] += "\n"
        lines.append(new_line)

    SERVER_ENV_PATH.write_text("".join(lines))


async def create_single_org_seed(
    session: AsyncSession, redis: Redis, slug: str
) -> None:
    """Create a single organization with products, customers, and timeline events."""
    name = slug.replace("-", " ").title()

    user, _created = await user_service.get_by_email_or_create(
        session=session,
        email=f"{slug}@polar.sh",
    )
    user_repository = UserRepository.from_session(session)
    await user_repository.update(
        user,
        update_dict={
            "is_admin": True,
            "identity_verification_status": IdentityVerificationStatus.verified,
            "identity_verification_id": f"vs_{slug}_test",
        },
    )

    auth_subject = AuthSubject(subject=user, scopes=set(), session=None)

    organization = await organization_service.create(
        session=session,
        create_schema=OrganizationCreate(name=name, slug=slug),
        auth_subject=auth_subject,
    )
    organization.email = f"{slug}@polar.sh"
    organization.bio = f"Seeded organization: {name}"
    organization.set_status(OrganizationStatus.ACTIVE)
    organization.details_submitted_at = utc_now()
    organization.initially_reviewed_at = utc_now()
    session.add(organization)

    organization_review = OrganizationReview(
        organization_id=organization.id,
        verdict=OrganizationReview.Verdict.PASS,
        risk_score=0.0,
        violated_sections=[],
        reason="Seed data - automatically approved",
        timed_out=False,
        model_used="seed",
        validated_at=utc_now(),
        organization_details_snapshot={},
    )
    session.add(organization_review)

    # Attach a fake payout account so the seeded org is payout-ready
    await create_fake_payout_account(session, organization, user)

    # Create a mix of recurring and one-time products
    products_data = [
        (
            "Pro Plan",
            "Monthly pro subscription",
            2900,
            SubscriptionRecurringInterval.month,
        ),
        (
            "Business Plan",
            "Monthly business subscription",
            9900,
            SubscriptionRecurringInterval.month,
        ),
        (
            "Enterprise",
            "Annual enterprise subscription",
            99900,
            SubscriptionRecurringInterval.year,
        ),
        ("Starter Kit", "One-time starter package", 4900, None),
        ("Premium Add-on", "One-time premium add-on", 1900, None),
    ]

    org_products: list[Product] = []
    for prod_name, prod_desc, price, interval in products_data:
        price_create = ProductPriceFixedCreate(
            amount_type=ProductPriceAmountType.fixed,
            tax_behavior=TaxBehaviorOption.exclusive,
            price_amount=price,
            price_currency=PresentmentCurrency.usd,
        )
        product_create: ProductCreate
        if interval is None:
            product_create = ProductCreateOneTime(
                name=prod_name,
                description=prod_desc,
                organization_id=organization.id,
                prices=[price_create],
            )
        else:
            product_create = ProductCreateRecurring(
                name=prod_name,
                description=prod_desc,
                organization_id=organization.id,
                recurring_interval=interval,
                prices=[price_create],
            )
        product = await product_service.create(
            session=session,
            create_schema=product_create,
            auth_subject=auth_subject,
        )
        org_products.append(product)

    # Pre-load product prices for timeline event generation
    for p in org_products:
        await session.refresh(p, ["all_prices"])

    # Create customers with timeline events. Accumulate events across
    # customers and flush to Tinybird once at the end to avoid per-customer
    # synchronous HTTP round-trips (wait=true is ~4s each).
    pending_events: list[dict[str, Any]] = []

    num_customers = random.randint(5, 10)
    for i in range(num_customers):
        customer_email = f"customer_{slug}_{i + 1}@polar.sh"
        customer = await customer_service.create(
            session=session,
            customer_create=CustomerIndividualCreate(
                email=customer_email,
                name=f"Customer {i + 1}",
                organization_id=organization.id,
            ),
            auth_subject=auth_subject,
        )

        timeline_events = _build_customer_timeline_events(
            organization_id=organization.id,
            customer_id=customer.id,
            customer_email=customer_email,
            customer_name=f"Customer {i + 1}",
            products=org_products,
        )

        pending_events.extend(timeline_events)

    inserted_event_count = 0
    if pending_events:
        event_repository = EventRepository.from_session(session)
        _normalize_seed_event_batch(pending_events)
        await _stamp_event_type_ids(session, pending_events)
        event_ids, _ = await event_repository.insert_batch(
            pending_events, render_nulls=True
        )
        inserted_event_count = len(event_ids)
        if event_ids:
            inserted = await event_repository.get_all(
                select(EventModel).where(EventModel.id.in_(event_ids))
            )
            ancestors_by_event = await event_repository.get_ancestors_batch(event_ids)
            await _flush_tinybird_events(inserted, ancestors_by_event)

    await session.commit()
    print(f"✅ Created organization '{name}' ({slug})")
    print(
        f"   {len(org_products)} products, {num_customers} customers, "
        f"{inserted_event_count} timeline events"
    )


@cli.callback()
def seeds_load(
    ctx: typer.Context,
    new_org: str | None = typer.Option(
        None,
        "--new-org",
        help="Create a single new organization with this slug, with products, customers, and timeline events.",
    ),
    phase: SeedPhase = typer.Option(
        SeedPhase.all,
        "--phase",
        help="Seed all data, readiness-critical fixtures only, or deferred demo data.",
    ),
) -> None:
    """Load sample/test data into the database."""
    if ctx.invoked_subcommand is not None:
        return
    if new_org is not None and phase is not SeedPhase.all:
        raise typer.BadParameter("--new-org cannot be combined with --phase")

    async def run() -> None:
        redis = create_redis("app")
        async with JobQueueManager.open(dramatiq.get_broker(), redis):
            engine = create_async_engine("script")
            sessionmaker = create_async_sessionmaker(engine)
            sql_executions = 0

            def count_sql_executions(*args: Any) -> None:
                nonlocal sql_executions
                sql_executions += 1

            sqlalchemy_event.listen(
                engine.sync_engine, "before_cursor_execute", count_sql_executions
            )
            try:
                async with sessionmaker() as session:
                    if new_org:
                        await create_single_org_seed(session, redis, new_org)
                    elif phase is SeedPhase.simple:
                        await create_simple_seed_data(session, redis)
                    elif phase is SeedPhase.simple_complement:
                        await create_simple_complement_seed_data(session)
                    else:
                        await create_seed_data(session, redis)
            finally:
                sqlalchemy_event.remove(
                    engine.sync_engine, "before_cursor_execute", count_sql_executions
                )
                print(f"seed.sql executions={sql_executions}")

    asyncio.run(run())


@cli.command(name="polar-self-env")
def polar_self_env() -> None:
    """Output Polar self-integration env vars for the seeded Polar org."""

    async def run() -> None:
        engine = create_async_engine("script")
        sessionmaker = create_async_sessionmaker(engine)
        async with sessionmaker() as session:
            org = (
                await session.execute(
                    select(Organization).where(Organization.slug == POLAR_ORG_SLUG)
                )
            ).scalar_one_or_none()
            if org is None:
                raise typer.Exit(1)

            scale_product = (
                await session.execute(
                    select(Product).where(
                        Product.organization_id == org.id,
                        Product.name == SCALE_PRODUCT_NAME,
                    )
                )
            ).scalar_one_or_none()
            if scale_product is None:
                raise typer.Exit(1)

            # Delete any existing dev seed token
            existing = (
                (
                    await session.execute(
                        select(OrganizationAccessToken).where(
                            OrganizationAccessToken.organization_id == org.id,
                            OrganizationAccessToken.comment == TOKEN_COMMENT,
                        )
                    )
                )
                .scalars()
                .all()
            )
            for t in existing:
                await session.delete(t)

            token, token_hash = generate_token_hash_pair(
                secret=settings.SECRET,
                prefix="polar_oat_",
            )
            oat = OrganizationAccessToken(
                organization_id=org.id,
                token=token_hash,
                scope=TOKEN_SCOPES,
                comment=TOKEN_COMMENT,
            )
            session.add(oat)

            existing_webhooks = (
                (
                    await session.execute(
                        select(WebhookEndpoint).where(
                            WebhookEndpoint.organization_id == org.id,
                            WebhookEndpoint.name == WEBHOOK_NAME,
                        )
                    )
                )
                .scalars()
                .all()
            )
            for w in existing_webhooks:
                await session.delete(w)

            webhook_secret = generate_token(prefix=WEBHOOK_SECRET_PREFIX)
            webhook = WebhookEndpoint(
                organization_id=org.id,
                url=WEBHOOK_URL,
                name=WEBHOOK_NAME,
                format=WebhookFormat.raw,
                secret=webhook_secret,
                secret_generated_at=utc_now(),
                events=WEBHOOK_EVENTS,
                enabled=True,
            )
            session.add(webhook)

            await session.commit()

            _write_webhook_secret_to_env(webhook_secret)

            print(f"POLAR_POLAR_ORGANIZATION_ID={org.id}")
            print(f"POLAR_POLAR_SCALE_PRODUCT_ID={scale_product.id}")
            print(f"POLAR_POLAR_ACCESS_TOKEN={token}")
            print(f"{WEBHOOK_SECRET_ENV_KEY}={webhook_secret}")
            print("POLAR_POLAR_API_URL=http://127.0.0.1:8000")

        await engine.dispose()

    asyncio.run(run())


@cli.command(name="customer-portal-session")
def customer_portal_session(
    org_slug: str = typer.Option(
        "acme-corp",
        "--org",
        help="Organization slug to pick a customer from. The seed only gives "
        "acme-corp real subscriptions.",
    ),
    ttl_hours: int = typer.Option(
        24,
        "--ttl-hours",
        help="Session lifetime. The default outlives a `dev snap` run, "
        "which captures both branches against one set of URLs.",
        min=1,
    ),
) -> None:
    """Mint a customer session over seeded data and output it for dev tooling."""

    async def run() -> None:
        engine = create_async_engine("script")
        sessionmaker = create_async_sessionmaker(engine)
        async with sessionmaker() as session:
            subscription = (
                await session.execute(
                    select(Subscription)
                    .join(Organization, Subscription.organization_id == Organization.id)
                    .where(
                        Organization.slug == org_slug,
                        Subscription.status == SubscriptionStatus.active,
                    )
                    .options(joinedload(Subscription.customer))
                    .order_by(Subscription.created_at)
                    .limit(1)
                )
            ).scalar_one_or_none()
            if subscription is None:
                available = (
                    (
                        await session.execute(
                            select(Organization.slug)
                            .join(
                                Subscription,
                                Subscription.organization_id == Organization.id,
                            )
                            .where(Subscription.status == SubscriptionStatus.active)
                            .distinct()
                            .order_by(Organization.slug)
                        )
                    )
                    .scalars()
                    .all()
                )
                print(f"No active subscription in '{org_slug}'.")
                if available:
                    print(f"Try --org {' or --org '.join(available)}.")
                else:
                    print("No organization has one. Run `dev seed` first.")
                raise typer.Exit(1)

            customer = subscription.customer

            order_id = (
                await session.execute(
                    select(Order.id)
                    .where(Order.customer_id == customer.id)
                    .order_by(Order.created_at.desc())
                    .limit(1)
                )
            ).scalar_one_or_none()

            token, token_hash = generate_token_hash_pair(
                secret=settings.SECRET, prefix=CUSTOMER_SESSION_TOKEN_PREFIX
            )
            session.add(
                CustomerSession(
                    token=token_hash,
                    customer_id=customer.id,
                    expires_at=utc_now() + timedelta(hours=ttl_hours),
                )
            )
            await session.commit()

            print(f"ORGANIZATION_SLUG={org_slug}")
            print(f"CUSTOMER_SESSION_TOKEN={token}")
            print(f"SUBSCRIPTION_ID={subscription.id}")
            if order_id:
                print(f"ORDER_ID={order_id}")

        await engine.dispose()

    asyncio.run(run())


if __name__ == "__main__":
    cli()
