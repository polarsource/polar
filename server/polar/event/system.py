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
