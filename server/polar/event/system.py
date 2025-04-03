from enum import StrEnum
from typing import TYPE_CHECKING, Literal

from sqlalchemy.orm import Mapped
from sqlalchemy.util.typing import TypedDict
from typing_extensions import TypeIs

from polar.models import Customer, Event, Organization
from polar.models.event import EventSource


class MeterCreditedMetadata(TypedDict):
    meter_id: str
    units: int


class SystemEvent(StrEnum):
    meter_credited = "meter_credited"


class MeterCreditedEvent(Event):
    if TYPE_CHECKING:
        source: Mapped[Literal[EventSource.system]]
        name: Mapped[Literal[SystemEvent.meter_credited]]
        user_metadata: Mapped[MeterCreditedMetadata]  # type: ignore[assignment]


# TODO: add @typing.overload when we have more than one event
def build_system_event(
    name: Literal[SystemEvent.meter_credited],
    customer: Customer,
    organization: Organization,
    metadata: MeterCreditedMetadata,
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
