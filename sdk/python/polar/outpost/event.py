import collections.abc
import dataclasses
import datetime
import typing

import typing_extensions

from polar.v2026_04.inputs import (
    EventCreateCustomer as EventCreateCustomerv2026_04,
)
from polar.v2026_04.inputs import (
    EventCreateExternalCustomer as EventCreateExternalCustomerv2026_04,
)
from polar.v2026_10.inputs import (
    EventCreateCustomer as EventCreateCustomerv2026_10,
)
from polar.v2026_10.inputs import (
    EventCreateExternalCustomer as EventCreateExternalCustomerv2026_10,
)
from polar.v2027_01.inputs import (
    EventCreateCustomer as EventCreateCustomerv2027_01,
)
from polar.v2027_01.inputs import (
    EventCreateExternalCustomer as EventCreateExternalCustomerv2027_01,
)

EventInput: typing.TypeAlias = EventCreateCustomerv2026_04 | EventCreateExternalCustomerv2026_04 | EventCreateCustomerv2026_10 | EventCreateExternalCustomerv2026_10 | EventCreateCustomerv2027_01 | EventCreateExternalCustomerv2027_01


@dataclasses.dataclass
class Event:
    name: str
    external_customer_id: str
    timestamp: datetime.datetime
    metadata: typing_extensions.Mapping[typing.Any, typing.Any] = dataclasses.field(
        default_factory=dict
    )

    def __post_init__(self) -> None:
        if self.timestamp.utcoffset() is None:
            raise ValueError("Event timestamps must include a timezone")

    def get_property(self, property: str) -> typing.Any:
        match property:
            case "name":
                return self.name
            case "source":
                return "user"
            case "timestamp":
                return int(self.timestamp.timestamp())
            case _:
                value: typing.Any = self.metadata
                for part in property.removeprefix("metadata.").split("."):
                    if not isinstance(value, collections.abc.Mapping):
                        return None
                    value = value.get(part)
                return value
