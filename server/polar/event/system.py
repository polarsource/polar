from enum import StrEnum
from typing import TYPE_CHECKING, Any, Literal, NotRequired, overload

from sqlalchemy.orm import Mapped
from sqlalchemy.util.typing import TypedDict

from polar.kit.address import AddressDict
from polar.models import Customer, Event, Organization
from polar.models.benefit import BenefitType
from polar.models.event import EventSource


class SystemEvent(StrEnum):
    meter_credited = "meter.credited"
    meter_reset = "meter.reset"
    benefit_granted = "benefit.granted"
    benefit_cycled = "benefit.cycled"
    benefit_updated = "benefit.updated"
    benefit_revoked = "benefit.revoked"
    subscription_created = "subscription.created"
    subscription_canceled = "subscription.canceled"
    subscription_cycled = "subscription.cycled"
    subscription_revoked = "subscription.revoked"
    subscription_uncanceled = "subscription.uncanceled"
    subscription_product_updated = "subscription.product_updated"
    subscription_seats_updated = "subscription.seats_updated"
    subscription_billing_period_updated = "subscription.billing_period_updated"
    order_paid = "order.paid"
    order_refunded = "order.refunded"
    checkout_created = "checkout.created"
    customer_created = "customer.created"
    customer_updated = "customer.updated"
    customer_deleted = "customer.deleted"


SYSTEM_EVENT_LABELS: dict[str, str] = {
    "benefit.granted": "Benefit Granted",
    "benefit.cycled": "Benefit Cycled",
    "benefit.updated": "Benefit Updated",
    "benefit.revoked": "Benefit Revoked",
    "subscription.created": "Subscription Created",
    "subscription.canceled": "Subscription Canceled",
    "subscription.cycled": "Subscription Cycled",
    "subscription.revoked": "Subscription Revoked",
    "subscription.uncanceled": "Subscription Uncanceled",
    "subscription.product_updated": "Subscription Product Updated",
    "order.paid": "Order Paid",
    "order.refunded": "Order Refunded",
    "checkout.created": "Checkout Created",
    "subscription.seats_updated": "Subscription Seats Updated",
    "customer.created": "Customer Created",
    "customer.updated": "Customer Updated",
    "customer.deleted": "Customer Deleted",
    "meter.credited": "Meter Credited",
    "meter.reset": "Meter Reset",
}


class MeterCreditedMetadata(TypedDict):
    meter_id: str
    units: int
    rollover: bool


class MeterCreditedEvent(Event):
    if TYPE_CHECKING:
        source: Mapped[Literal[EventSource.system]]
        name: Mapped[Literal[SystemEvent.meter_credited]]
        user_metadata: Mapped[MeterCreditedMetadata]  # type: ignore[assignment]


class MeterResetMetadata(TypedDict):
    meter_id: str


class MeterResetEvent(Event):
    if TYPE_CHECKING:
        source: Mapped[Literal[EventSource.system]]
        name: Mapped[Literal[SystemEvent.meter_reset]]
        user_metadata: Mapped[MeterResetMetadata]  # type: ignore[assignment]


class BenefitGrantMetadata(TypedDict):
    benefit_id: str
    benefit_grant_id: str
    benefit_type: BenefitType


class BenefitGrantedEvent(Event):
    if TYPE_CHECKING:
        source: Mapped[Literal[EventSource.system]]
        name: Mapped[Literal[SystemEvent.benefit_granted]]
        user_metadata: Mapped[BenefitGrantMetadata]  # type: ignore[assignment]


class BenefitCycledEvent(Event):
    if TYPE_CHECKING:
        source: Mapped[Literal[EventSource.system]]
        name: Mapped[Literal[SystemEvent.benefit_cycled]]
        user_metadata: Mapped[BenefitGrantMetadata]  # type: ignore[assignment]


class BenefitUpdatedEvent(Event):
    if TYPE_CHECKING:
        source: Mapped[Literal[EventSource.system]]
        name: Mapped[Literal[SystemEvent.benefit_updated]]
        user_metadata: Mapped[BenefitGrantMetadata]  # type: ignore[assignment]


class BenefitRevokedEvent(Event):
    if TYPE_CHECKING:
        source: Mapped[Literal[EventSource.system]]
        name: Mapped[Literal[SystemEvent.benefit_revoked]]
        user_metadata: Mapped[BenefitGrantMetadata]  # type: ignore[assignment]


class CustomerCreatedMetadata(TypedDict):
    customer_id: str
    customer_email: str
    customer_name: str | None
    customer_external_id: str | None


class CustomerCreatedEvent(Event):
    if TYPE_CHECKING:
        source: Mapped[Literal[EventSource.system]]
        name: Mapped[Literal[SystemEvent.customer_created]]
        user_metadata: Mapped[CustomerCreatedMetadata]  # type: ignore[assignment]


class CustomerUpdatedFields(TypedDict):
    name: NotRequired[str | None]
    email: NotRequired[str | None]
    billing_address: NotRequired[AddressDict | None]
    tax_id: NotRequired[str | None]
    metadata: NotRequired[dict[str, str | int | bool] | None]


class CustomerUpdatedMetadata(TypedDict):
    customer_id: str
    customer_email: str
    customer_name: str | None
    customer_external_id: str | None
    updated_fields: CustomerUpdatedFields


class CustomerUpdatedEvent(Event):
    if TYPE_CHECKING:
        source: Mapped[Literal[EventSource.system]]
        name: Mapped[Literal[SystemEvent.customer_updated]]
        user_metadata: Mapped[CustomerUpdatedMetadata]  # type: ignore[assignment]


class CustomerDeletedMetadata(TypedDict):
    customer_id: str
    customer_email: str
    customer_name: str | None
    customer_external_id: str | None


class CustomerDeletedEvent(Event):
    if TYPE_CHECKING:
        source: Mapped[Literal[EventSource.system]]
        name: Mapped[Literal[SystemEvent.customer_deleted]]
        user_metadata: Mapped[CustomerDeletedMetadata]  # type: ignore[assignment]


class SubscriptionCreatedMetadata(TypedDict):
    subscription_id: str
    product_id: str
    amount: int
    currency: str
    recurring_interval: str
    recurring_interval_count: int
    started_at: str


class SubscriptionCreatedEvent(Event):
    if TYPE_CHECKING:
        source: Mapped[Literal[EventSource.system]]
        name: Mapped[Literal[SystemEvent.subscription_created]]
        user_metadata: Mapped[SubscriptionCreatedMetadata]  # type: ignore[assignment]


class SubscriptionCanceledMetadata(TypedDict):
    subscription_id: str
    product_id: NotRequired[str]
    amount: int
    currency: str
    recurring_interval: str
    recurring_interval_count: int
    customer_cancellation_reason: NotRequired[str]
    customer_cancellation_comment: NotRequired[str]
    canceled_at: str
    ends_at: NotRequired[str]
    cancel_at_period_end: NotRequired[bool]


class SubscriptionCanceledEvent(Event):
    if TYPE_CHECKING:
        source: Mapped[Literal[EventSource.system]]
        name: Mapped[Literal[SystemEvent.subscription_canceled]]
        user_metadata: Mapped[SubscriptionCanceledMetadata]  # type: ignore[assignment]


class SubscriptionCycledMetadata(TypedDict):
    subscription_id: str
    product_id: NotRequired[str]
    amount: NotRequired[int]
    currency: NotRequired[str]
    recurring_interval: NotRequired[str]
    recurring_interval_count: NotRequired[int]


class SubscriptionCycledEvent(Event):
    if TYPE_CHECKING:
        source: Mapped[Literal[EventSource.system]]
        name: Mapped[Literal[SystemEvent.subscription_cycled]]
        user_metadata: Mapped[SubscriptionCycledMetadata]  # type: ignore[assignment]


class SubscriptionRevokedMetadata(TypedDict):
    subscription_id: str
    product_id: NotRequired[str]
    amount: NotRequired[int]
    currency: NotRequired[str]
    recurring_interval: NotRequired[str]
    recurring_interval_count: NotRequired[int]


class SubscriptionRevokedEvent(Event):
    if TYPE_CHECKING:
        source: Mapped[Literal[EventSource.system]]
        name: Mapped[Literal[SystemEvent.subscription_revoked]]
        user_metadata: Mapped[SubscriptionRevokedMetadata]  # type: ignore[assignment]


class SubscriptionUncanceledMetadata(TypedDict):
    subscription_id: str
    product_id: str
    amount: int
    currency: str
    recurring_interval: str
    recurring_interval_count: int


class SubscriptionUncanceledEvent(Event):
    if TYPE_CHECKING:
        source: Mapped[Literal[EventSource.system]]
        name: Mapped[Literal[SystemEvent.subscription_uncanceled]]
        user_metadata: Mapped[SubscriptionUncanceledMetadata]  # type: ignore[assignment]


class SubscriptionProductUpdatedMetadata(TypedDict):
    subscription_id: str
    old_product_id: str
    new_product_id: str


class SubscriptionProductUpdatedEvent(Event):
    if TYPE_CHECKING:
        source: Mapped[Literal[EventSource.system]]
        name: Mapped[Literal[SystemEvent.subscription_product_updated]]
        user_metadata: Mapped[SubscriptionProductUpdatedMetadata]  # type: ignore[assignment]


class SubscriptionSeatsUpdatedMetadata(TypedDict):
    subscription_id: str
    old_seats: int
    new_seats: int
    proration_behavior: str


class SubscriptionSeatsUpdatedEvent(Event):
    if TYPE_CHECKING:
        source: Mapped[Literal[EventSource.system]]
        name: Mapped[Literal[SystemEvent.subscription_seats_updated]]
        user_metadata: Mapped[SubscriptionSeatsUpdatedMetadata]  # type: ignore[assignment]


class SubscriptionBillingPeriodUpdatedMetadata(TypedDict):
    subscription_id: str
    old_period_end: str
    new_period_end: str


class SubscriptionBillingPeriodUpdatedEvent(Event):
    if TYPE_CHECKING:
        source: Mapped[Literal[EventSource.system]]
        name: Mapped[Literal[SystemEvent.subscription_billing_period_updated]]
        user_metadata: Mapped[SubscriptionBillingPeriodUpdatedMetadata]  # type: ignore[assignment]


class OrderPaidMetadata(TypedDict):
    order_id: str
    product_id: NotRequired[str]
    billing_type: NotRequired[str]
    amount: int
    currency: NotRequired[str]
    net_amount: NotRequired[int]
    tax_amount: NotRequired[int]
    applied_balance_amount: NotRequired[int]
    discount_amount: NotRequired[int]
    discount_id: NotRequired[str]
    platform_fee: NotRequired[int]
    subscription_id: NotRequired[str]
    recurring_interval: NotRequired[str]
    recurring_interval_count: NotRequired[int]


class OrderPaidEvent(Event):
    if TYPE_CHECKING:
        source: Mapped[Literal[EventSource.system]]
        name: Mapped[Literal[SystemEvent.order_paid]]
        user_metadata: Mapped[OrderPaidMetadata]  # type: ignore[assignment]


class OrderRefundedMetadata(TypedDict):
    order_id: str
    refunded_amount: int
    currency: str


class OrderRefundedEvent(Event):
    if TYPE_CHECKING:
        source: Mapped[Literal[EventSource.system]]
        name: Mapped[Literal[SystemEvent.order_refunded]]
        user_metadata: Mapped[OrderRefundedMetadata]  # type: ignore[assignment]


class CheckoutCreatedMetadata(TypedDict):
    checkout_id: str
    checkout_status: str
    product_id: NotRequired[str]


class CheckoutCreatedEvent(Event):
    if TYPE_CHECKING:
        source: Mapped[Literal[EventSource.system]]
        name: Mapped[Literal[SystemEvent.checkout_created]]
        user_metadata: Mapped[CheckoutCreatedMetadata]  # type: ignore[assignment]


@overload
def build_system_event(
    name: Literal[SystemEvent.meter_credited],
    customer: Customer,
    organization: Organization,
    metadata: MeterCreditedMetadata,
) -> Event: ...


@overload
def build_system_event(
    name: Literal[SystemEvent.meter_reset],
    customer: Customer,
    organization: Organization,
    metadata: MeterResetMetadata,
) -> Event: ...


@overload
def build_system_event(
    name: Literal[SystemEvent.benefit_granted],
    customer: Customer,
    organization: Organization,
    metadata: BenefitGrantMetadata,
) -> Event: ...


@overload
def build_system_event(
    name: Literal[SystemEvent.benefit_cycled],
    customer: Customer,
    organization: Organization,
    metadata: BenefitGrantMetadata,
) -> Event: ...


@overload
def build_system_event(
    name: Literal[SystemEvent.benefit_updated],
    customer: Customer,
    organization: Organization,
    metadata: BenefitGrantMetadata,
) -> Event: ...


@overload
def build_system_event(
    name: Literal[SystemEvent.benefit_revoked],
    customer: Customer,
    organization: Organization,
    metadata: BenefitGrantMetadata,
) -> Event: ...


@overload
def build_system_event(
    name: Literal[SystemEvent.customer_created],
    customer: Customer,
    organization: Organization,
    metadata: CustomerCreatedMetadata,
) -> Event: ...


@overload
def build_system_event(
    name: Literal[SystemEvent.customer_updated],
    customer: Customer,
    organization: Organization,
    metadata: CustomerUpdatedMetadata,
) -> Event: ...


@overload
def build_system_event(
    name: Literal[SystemEvent.customer_deleted],
    customer: Customer,
    organization: Organization,
    metadata: CustomerDeletedMetadata,
) -> Event: ...


@overload
def build_system_event(
    name: Literal[SystemEvent.subscription_created],
    customer: Customer,
    organization: Organization,
    metadata: SubscriptionCreatedMetadata,
) -> Event: ...


@overload
def build_system_event(
    name: Literal[SystemEvent.subscription_canceled],
    customer: Customer,
    organization: Organization,
    metadata: SubscriptionCanceledMetadata,
) -> Event: ...


@overload
def build_system_event(
    name: Literal[SystemEvent.subscription_cycled],
    customer: Customer,
    organization: Organization,
    metadata: SubscriptionCycledMetadata,
) -> Event: ...


@overload
def build_system_event(
    name: Literal[SystemEvent.subscription_revoked],
    customer: Customer,
    organization: Organization,
    metadata: SubscriptionRevokedMetadata,
) -> Event: ...


@overload
def build_system_event(
    name: Literal[SystemEvent.subscription_uncanceled],
    customer: Customer,
    organization: Organization,
    metadata: SubscriptionUncanceledMetadata,
) -> Event: ...


@overload
def build_system_event(
    name: Literal[SystemEvent.subscription_product_updated],
    customer: Customer,
    organization: Organization,
    metadata: SubscriptionProductUpdatedMetadata,
) -> Event: ...


@overload
def build_system_event(
    name: Literal[SystemEvent.subscription_seats_updated],
    customer: Customer,
    organization: Organization,
    metadata: SubscriptionSeatsUpdatedMetadata,
) -> Event: ...


@overload
def build_system_event(
    name: Literal[SystemEvent.subscription_billing_period_updated],
    customer: Customer,
    organization: Organization,
    metadata: SubscriptionBillingPeriodUpdatedMetadata,
) -> Event: ...


@overload
def build_system_event(
    name: Literal[SystemEvent.order_paid],
    customer: Customer,
    organization: Organization,
    metadata: OrderPaidMetadata,
) -> Event: ...


@overload
def build_system_event(
    name: Literal[SystemEvent.order_refunded],
    customer: Customer,
    organization: Organization,
    metadata: OrderRefundedMetadata,
) -> Event: ...


def build_system_event(
    name: SystemEvent,
    customer: Customer,
    organization: Organization,
    metadata: Any,
) -> Event:
    return Event(
        name=name,
        source=EventSource.system,
        customer_id=customer.id,
        organization=organization,
        user_metadata=metadata,
    )


def build_checkout_event(
    name: Literal[SystemEvent.checkout_created],
    organization: Organization,
    metadata: CheckoutCreatedMetadata,
) -> Event:
    return Event(
        name=name,
        source=EventSource.system,
        customer_id=None,
        organization=organization,
        user_metadata=metadata,
    )
