from enum import StrEnum
from typing import TYPE_CHECKING, Any, Literal, overload

from sqlalchemy.orm import Mapped
from sqlalchemy.util.typing import TypedDict

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
    subscription_cycled = "subscription.cycled"
    subscription_revoked = "subscription.revoked"
    subscription_product_updated = "subscription.product_updated"
    subscription_seats_updated = "subscription.seats_updated"
    order_paid = "order.paid"
    order_refunded = "order.refunded"


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


class SubscriptionCycledMetadata(TypedDict):
    subscription_id: str


class SubscriptionCycledEvent(Event):
    if TYPE_CHECKING:
        source: Mapped[Literal[EventSource.system]]
        name: Mapped[Literal[SystemEvent.subscription_cycled]]
        user_metadata: Mapped[SubscriptionCycledMetadata]  # type: ignore[assignment]


class SubscriptionRevokedMetadata(TypedDict):
    subscription_id: str


class SubscriptionRevokedEvent(Event):
    if TYPE_CHECKING:
        source: Mapped[Literal[EventSource.system]]
        name: Mapped[Literal[SystemEvent.subscription_revoked]]
        user_metadata: Mapped[SubscriptionRevokedMetadata]  # type: ignore[assignment]


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


class OrderPaidMetadata(TypedDict):
    order_id: str
    amount: int
    currency: str


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
