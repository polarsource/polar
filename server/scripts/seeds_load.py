import asyncio
import random
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any, Literal, NotRequired, TypedDict
from uuid import UUID

import dramatiq
import typer
from sqlalchemy import select

import polar.tasks  # noqa: F401
from polar.auth.models import AuthSubject
from polar.auth.scope import Scope
from polar.benefit.service import benefit as benefit_service
from polar.benefit.strategies.custom.schemas import BenefitCustomCreate
from polar.benefit.strategies.downloadables.schemas import BenefitDownloadablesCreate

# Import tasks to register all dramatiq actors
from polar.benefit.strategies.license_keys.schemas import BenefitLicenseKeysCreate
from polar.checkout_link.schemas import CheckoutLinkCreateProducts
from polar.checkout_link.service import checkout_link as checkout_link_service
from polar.config import settings
from polar.customer.schemas.customer import CustomerIndividualCreate
from polar.customer.service import customer as customer_service
from polar.discount.schemas import DiscountPercentageCreate
from polar.discount.service import discount as discount_service
from polar.enums import (
    PaymentProcessor,
    PayoutAccountType,
    SubscriptionRecurringInterval,
    TaxBehavior,
    TaxBehaviorOption,
)
from polar.event.repository import EventRepository
from polar.event.system import SystemEvent as SystemEventEnum
from polar.event_type.repository import EventTypeRepository
from polar.integrations.tinybird.service import ingest_events as tinybird_ingest_events
from polar.kit.crypto import generate_token_hash_pair
from polar.kit.currency import PresentmentCurrency
from polar.kit.db.postgres import create_async_sessionmaker
from polar.kit.utils import generate_uuid, utc_now
from polar.meter.aggregation import CountAggregation
from polar.meter.filter import Filter, FilterClause, FilterConjunction, FilterOperator
from polar.meter.schemas import MeterCreate
from polar.meter.service import meter as meter_service
from polar.models.benefit import BenefitType
from polar.models.customer_seat import CustomerSeat, SeatStatus
from polar.models.discount import DiscountDuration, DiscountType
from polar.models.event import Event as EventModel
from polar.models.file import File, FileServiceTypes
from polar.models.member import Member, MemberRole
from polar.models.organization import (
    Organization,
    OrganizationDetails,
    OrganizationStatus,
)
from polar.models.organization_access_token import OrganizationAccessToken
from polar.models.organization_review import OrganizationReview
from polar.models.payout_account import PayoutAccount
from polar.models.product import Product
from polar.models.product_price import (
    ProductPriceAmountType,
    ProductPriceSeatUnit,
)
from polar.models.subscription import Subscription, SubscriptionStatus
from polar.models.subscription_product_price import SubscriptionProductPrice
from polar.models.user import IdentityVerificationStatus, User
from polar.organization.schemas import OrganizationCreate
from polar.organization.service import organization as organization_service
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
from polar.user.repository import UserRepository
from polar.user.service import user as user_service
from polar.worker import JobQueueManager

cli = typer.Typer(invoke_without_command=True)

# Chosen to stay well under Tinybird's 10MB payload limit at ~2KB/event.
TINYBIRD_FLUSH_CHUNK = 2500


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
    seat_based_customers: NotRequired[list[SeatBasedCustomerDict]]


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


async def _stamp_event_type_ids(
    session: AsyncSession, events: list[dict[str, Any]]
) -> None:
    """Stamp event_type_id on each event dict, mirroring the real ingest path."""
    event_type_repository = EventTypeRepository.from_session(session)
    cache: dict[tuple[str, Any], Any] = {}
    for event in events:
        name = event.get("name")
        org_id = event.get("organization_id")
        if not name or not org_id:
            continue
        key = (name, org_id)
        if key not in cache:
            event_type = await event_type_repository.get_or_create(name, org_id)
            cache[key] = event_type.id
        event["event_type_id"] = cache[key]


def _build_customer_timeline_events(
    organization_id: Any,
    customer_id: Any,
    customer_email: str,
    customer_name: str,
    products: list[Product],
) -> list[dict[str, Any]]:
    """Generate a realistic timeline of system events for a customer.

    Simulates a customer lifecycle: creation → checkout → subscription →
    recurring cycles with order payments → possible cancellation/refund.
    """
    events: list[dict[str, Any]] = []
    now = datetime.now(UTC)

    days_ago = random.randint(90, 540)
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
    t += timedelta(minutes=random.randint(1, 30))
    chosen_product = random.choice(recurring_products) if recurring_products else None
    if chosen_product:
        fake_checkout_id = str(generate_uuid())
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
        t += timedelta(minutes=random.randint(1, 5))
        fake_sub_id = str(generate_uuid())
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
        t += timedelta(seconds=random.randint(1, 30))
        fake_order_id = str(generate_uuid())
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
        t += timedelta(seconds=random.randint(1, 10))
        fake_benefit_id = str(generate_uuid())
        fake_grant_id = str(generate_uuid())
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
            cycle_order_id = str(generate_uuid())
            events.append(
                _evt(
                    SystemEventEnum.order_paid,
                    cycle_time + timedelta(seconds=random.randint(1, 60)),
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
                    cycle_time + timedelta(seconds=random.randint(1, 60)),
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
        roll = random.random()
        if roll < 0.15:
            # ~15% cancel then uncanceled
            cancel_time = t + timedelta(days=random.randint(10, days_ago - 5))
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
                uncancel_time = cancel_time + timedelta(days=random.randint(1, 5))
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
                other = random.choice(
                    [p for p in recurring_products if p.id != chosen_product.id]
                )
                upgrade_time = t + timedelta(
                    days=random.randint(7, min(60, days_ago - 5))
                )
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
            refund_time = t + timedelta(days=random.randint(5, min(30, days_ago - 5)))
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
            cancel_time = t + timedelta(days=random.randint(15, days_ago - 2))
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
    if onetime_products and random.random() < 0.4:
        otp = random.choice(onetime_products)
        otp_time = timeline_start + timedelta(
            days=random.randint(1, max(1, days_ago - 5))
        )
        if otp_time < now:
            otp_price = 4900
            for p in otp.all_prices:
                pa = getattr(p, "price_amount", None)
                if pa is not None:
                    otp_price = pa
                    break
            otp_order_id = str(generate_uuid())
            events.append(
                _evt(
                    SystemEventEnum.checkout_created,
                    otp_time,
                    {
                        "checkout_id": str(generate_uuid()),
                        "checkout_status": "succeeded",
                        "product_id": str(otp.id),
                    },
                )
            )
            events.append(
                _evt(
                    SystemEventEnum.order_paid,
                    otp_time + timedelta(minutes=random.randint(1, 5)),
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
    if random.random() < 0.3:
        update_time = timeline_start + timedelta(
            days=random.randint(2, max(2, days_ago - 2))
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
) -> list[dict[str, Any]]:
    """Generate user-event span hierarchies with _cost and _llm metadata.

    Models two span types:
    - Support flow: support_request → sentiment_analysis, draft_generated, email_sent, support_request_completed
    - Document flow: document_upload → document_process, s3_upload
    """
    events: list[dict[str, Any]] = []
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
    num_spans = random.randint(10, 40)
    for _ in range(num_spans):
        offset_seconds = random.randint(0, days_back * 86400)
        span_start = now - timedelta(seconds=offset_seconds)
        vendor = random.choice(llm_vendors)
        span_type = random.choice(["support", "document"])

        if span_type == "support":
            # Support request span:
            # support_request (root) → sentiment_analysis, draft_generated, email_sent, support_request_completed
            span_id = generate_uuid()
            events.append(
                _root_event(
                    "support_request",
                    span_id,
                    span_start,
                    {
                        "ticket_id": str(generate_uuid()),
                        "channel": random.choice(["email", "chat", "api"]),
                    },
                )
            )

            t = span_start

            # sentiment_analysis child
            t += timedelta(seconds=random.randint(1, 5))
            input_tokens = random.randint(200, 1500)
            output_tokens = random.randint(50, 300)
            events.append(
                _llm_child_event(
                    "sentiment_analysis",
                    span_id,
                    t,
                    input_tokens,
                    output_tokens,
                    vendor,
                    {
                        "sentiment": random.choice(
                            ["positive", "neutral", "negative", "frustrated"]
                        )
                    },
                )
            )

            # draft_generated child
            t += timedelta(seconds=random.randint(1, 10))
            input_tokens = random.randint(500, 3000)
            output_tokens = random.randint(200, 800)
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
            t += timedelta(seconds=random.randint(1, 3))
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
            t += timedelta(seconds=random.randint(60, 3600))
            events.append(
                _no_cost_child_event(
                    "support_request_completed",
                    span_id,
                    t,
                    {"resolution": random.choice(["resolved", "escalated", "closed"])},
                )
            )

        else:
            # Document processing span:
            # document_upload (root) → document_process, s3_upload
            span_id = generate_uuid()
            doc_id = str(generate_uuid())
            events.append(
                _root_event(
                    "document_upload",
                    span_id,
                    span_start,
                    {
                        "document_id": doc_id,
                        "filename": random.choice(
                            ["report.pdf", "contract.docx", "data.csv", "spec.txt"]
                        ),
                        "size_bytes": random.randint(5_000, 5_000_000),
                    },
                )
            )

            t = span_start

            # document_process child (LLM)
            t += timedelta(seconds=random.randint(1, 10))
            input_tokens = random.randint(1000, 8000)
            output_tokens = random.randint(300, 2000)
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
                        "task": random.choice(
                            ["summarize", "extract", "classify", "translate"]
                        ),
                    },
                )
            )

            # s3_upload child (infra cost)
            t += timedelta(seconds=random.randint(1, 5))
            size_gb = random.uniform(0.001, 0.05)
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


async def create_seed_data(session: AsyncSession, redis: Redis) -> None:
    """Create sample data for development and testing."""

    # Check if seed data already exists
    existing = (
        await session.execute(
            select(Organization).where(Organization.slug == "acme-corp")
        )
    ).scalar_one_or_none()
    if existing:
        raise typer.Exit(2)

    # Organizations data
    orgs_data: list[OrganizationDict] = [
        {
            "name": "Acme Corporation",
            "slug": "acme-corp",
            "email": "contact@acme-corp.com",
            "website": "https://acme-corp.com",
            "bio": "Leading provider of innovative solutions for modern businesses.",
            "status": OrganizationStatus.ACTIVE,
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
            "details": {
                "about": "Polar is an open source payment infrastructure platform for developers",
                "switching": False,
                "switching_from": None,
                "product_description": "SaaS platform for payment infrastructure",
                "previous_annual_revenue": 0,
            },
            "products": [
                {
                    "name": "Polar Pro",
                    "description": "Monthly subscription to Polar Pro features",
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
            "products": [
                {
                    "name": "Polar Default",
                    "description": "Default Polar plan with seat-based pricing",
                    "recurring": SubscriptionRecurringInterval.month,
                    "seat_based": True,
                    "price_per_seat": 0,
                },
            ],
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
        session.add(organization)

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

        # Create meter for Polar organization
        if org_data["slug"] == "polar":
            meter_create = MeterCreate(
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
                organization_id=organization.id,
            )
            await meter_service.create(
                session=session,
                meter_create=meter_create,
                auth_subject=auth_subject,
            )

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
            )
            org_products.append(product)

            # Track seat-based product for later subscription creation
            if product_data.get("seat_based", False):
                seat_based_product = product
                # Get the seat-based price from the freshly created product
                await session.refresh(product, ["all_prices"])
                for price in product.all_prices:
                    if isinstance(price, ProductPriceSeatUnit):
                        seat_based_price = price
                        break

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

            if org_data["slug"] == "acme-corp":
                e2e_checkout_link = await checkout_link_service.create(
                    session=session,
                    checkout_link_create=CheckoutLinkCreateProducts(
                        payment_processor=PaymentProcessor.stripe,
                        products=[product.id for product in org_products],
                        label="E2E test checkout",
                        allow_discount_codes=True,
                    ),
                    auth_subject=auth_subject,
                )
                e2e_checkout_link.client_secret = (
                    "polar_cl_e2e_seed_checkout_link_subscription"
                )
                session.add(e2e_checkout_link)
                await session.flush()

        if org_products:
            await discount_service.create(
                session=session,
                discount_create=DiscountPercentageCreate(
                    name="Free",
                    code="free",
                    type=DiscountType.percentage,
                    basis_points=10000,
                    duration=DiscountDuration.once,
                    organization_id=organization.id,
                ),
                auth_subject=auth_subject,
            )

        # Create customers for organization (skip if seat_based_customers are defined)
        # Pre-load product prices for timeline event generation
        for p in org_products:
            await session.refresh(p, ["all_prices"])

        # Accumulate events across all customers in this org, then flush to
        # Tinybird in a single batched call at the end. The per-customer
        # synchronous ingest (with wait=true) used to dominate seed runtime.
        pending_tinybird_events: list[EventModel] = []
        pending_tinybird_ancestors: dict[UUID, list[str]] = {}

        num_customers = (
            random.randint(3, 8) if not org_data.get("seat_based_customers") else 0
        )
        for i in range(num_customers):
            # customer_email = f"customer_{org_data['slug']}_{i + 1}@example.com"
            customer_email = f"customer_{org_data['slug']}_{i + 1}@polar.sh"
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

            event_repository = EventRepository.from_session(session)

            # Create meter events for ColdMail customers
            if org_data["slug"] == "coldmail" and coldmail_meter and i == 0:
                # Create events for the first customer showing usage over time
                meter_events: list[dict[str, Any]] = []

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
                        meter_events.append(
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

                timeline_events.extend(meter_events)

            # Add user-event cost spans (LLM / infra) for all customers
            cost_spans = _build_user_cost_span_events(
                organization_id=organization.id,
                customer_id=customer.id,
            )
            timeline_events.extend(cost_spans)

            # Insert events in batch; defer Tinybird ingest until all of the
            # org's customers are processed so we can send one batched call.
            if timeline_events:
                await _stamp_event_type_ids(session, timeline_events)
                event_ids, _ = await event_repository.insert_batch(timeline_events)
                if event_ids:
                    inserted = await event_repository.get_all(
                        select(EventModel).where(EventModel.id.in_(event_ids))
                    )
                    ancestors_by_event = await event_repository.get_ancestors_batch(
                        event_ids
                    )
                    pending_tinybird_events.extend(inserted)
                    pending_tinybird_ancestors.update(ancestors_by_event)

        await _flush_tinybird_events(
            pending_tinybird_events, pending_tinybird_ancestors
        )

        # Create seat-based customers with subscriptions and seats
        seat_based_customers = org_data.get("seat_based_customers", [])
        if seat_based_customers and seat_based_product and seat_based_price:
            member_model_enabled = org_data.get("feature_settings", {}).get(
                "member_model_enabled", False
            )

            for customer_data in seat_based_customers:
                # Create the customer
                seat_customer = await customer_service.create(
                    session=session,
                    customer_create=CustomerIndividualCreate(
                        email=customer_data["email"],
                        name=customer_data["name"],
                        organization_id=organization.id,
                    ),
                    auth_subject=auth_subject,
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
                    # The customer_service.create() already created the owner member
                    # when member_model_enabled is True. Fetch it from the database.
                    owner_result = await session.execute(
                        select(Member).where(
                            Member.customer_id == seat_customer.id,
                            Member.role == MemberRole.owner,
                        )
                    )
                    owner_member = owner_result.scalar_one_or_none()
                    if owner_member:
                        members_for_seats.append(owner_member)

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
                                subscription_id=subscription.id,
                                status=SeatStatus.claimed,
                                customer_id=seat_customer.id,
                                member_id=members_for_seats[i].id,
                                email=members_for_seats[i].email,
                                claimed_at=utc_now(),
                            )
                        else:
                            # Without member model - create a Customer for each seat holder
                            seat_holder_email = (
                                f"seat{i + 1}@{customer_data['email'].split('@')[1]}"
                            )
                            seat_holder_customer = await customer_service.create(
                                session=session,
                                customer_create=CustomerIndividualCreate(
                                    email=seat_holder_email,
                                    name=f"Seat Holder {i + 1}",
                                    organization_id=organization.id,
                                ),
                                auth_subject=auth_subject,
                            )
                            seat = CustomerSeat(
                                subscription_id=subscription.id,
                                status=SeatStatus.claimed,
                                customer_id=seat_holder_customer.id,
                                email=seat_holder_email,
                                claimed_at=utc_now(),
                            )
                    else:
                        # Pending seats (not yet allocated)
                        seat = CustomerSeat(
                            subscription_id=subscription.id,
                            status=SeatStatus.pending,
                            customer_id=seat_customer.id,
                        )
                    session.add(seat)

                await session.flush()

        # Downgrade user from admin (for non-admin users)
        # Preserve admin status if already granted by a previous organization
        await user_repository.update(
            user,
            update_dict={"is_admin": user.is_admin or org_data.get("is_admin", False)},
        )

    await session.commit()
    print("✅ Sample data created successfully!")
    print("Created 3 organizations with users, products, benefits, and customers")


POLAR_ORG_SLUG = "polar"
TOKEN_COMMENT = "Polar self-integration (dev seed)"
TOKEN_SCOPES = " ".join(
    [
        Scope.customers_read,
        Scope.customers_write,
        Scope.subscriptions_write,
        Scope.events_write,
        Scope.members_read,
        Scope.members_write,
    ]
)


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
    pending_tinybird_events: list[EventModel] = []
    pending_tinybird_ancestors: dict[UUID, list[str]] = {}

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

        if timeline_events:
            event_repository = EventRepository.from_session(session)
            await _stamp_event_type_ids(session, timeline_events)
            event_ids, _ = await event_repository.insert_batch(timeline_events)
            if event_ids:
                inserted = await event_repository.get_all(
                    select(EventModel).where(EventModel.id.in_(event_ids))
                )
                ancestors_by_event = await event_repository.get_ancestors_batch(
                    event_ids
                )
                pending_tinybird_events.extend(inserted)
                pending_tinybird_ancestors.update(ancestors_by_event)

    await _flush_tinybird_events(pending_tinybird_events, pending_tinybird_ancestors)

    await session.commit()
    print(f"✅ Created organization '{name}' ({slug})")
    print(
        f"   {len(org_products)} products, {num_customers} customers with timeline events"
    )


@cli.callback()
def seeds_load(
    ctx: typer.Context,
    new_org: str | None = typer.Option(
        None,
        "--new-org",
        help="Create a single new organization with this slug, with products, customers, and timeline events.",
    ),
) -> None:
    """Load sample/test data into the database."""
    if ctx.invoked_subcommand is not None:
        return

    async def run() -> None:
        redis = create_redis("app")
        async with JobQueueManager.open(dramatiq.get_broker(), redis):
            engine = create_async_engine("script")
            sessionmaker = create_async_sessionmaker(engine)
            async with sessionmaker() as session:
                if new_org:
                    await create_single_org_seed(session, redis, new_org)
                else:
                    await create_seed_data(session, redis)

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

            product = (
                await session.execute(
                    select(Product).where(
                        Product.organization_id == org.id,
                        Product.name == "Polar Default",
                    )
                )
            ).scalar_one_or_none()
            if product is None:
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
            await session.commit()

            print(f"POLAR_POLAR_ORGANIZATION_ID={org.id}")
            print(f"POLAR_POLAR_FREE_PRODUCT_ID={product.id}")
            print(f"POLAR_POLAR_ACCESS_TOKEN={token}")
            print("POLAR_POLAR_API_URL=http://127.0.0.1:8000")

        await engine.dispose()

    asyncio.run(run())


if __name__ == "__main__":
    cli()
