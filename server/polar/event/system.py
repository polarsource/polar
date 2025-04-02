from enum import StrEnum
from typing import Literal

from sqlalchemy.util.typing import TypedDict

from polar.models import Customer, Event, Organization
from polar.models.event import EventSource


class MeterCreditedMetadata(TypedDict):
    meter_id: str
    units: int


class SystemEvent(StrEnum):
    meter_credited = "meter_credited"


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
