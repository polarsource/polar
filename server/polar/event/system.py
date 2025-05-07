from enum import StrEnum
from typing import TYPE_CHECKING, Any, Literal, overload

from sqlalchemy.orm import Mapped
from sqlalchemy.util.typing import TypedDict
from typing_extensions import TypeIs

from polar.models import Customer, Event, Organization
from polar.models.event import EventSource


class SystemEvent(StrEnum):
    meter_credited = "meter.credited"
    meter_reset = "meter.reset"


class MeterCreditedMetadata(TypedDict):
    meter_id: str
    units: int


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


def is_meter_credit_event(event: Event) -> TypeIs[MeterCreditedEvent]:
    return (
        event.source == EventSource.system and event.name == SystemEvent.meter_credited
    )
