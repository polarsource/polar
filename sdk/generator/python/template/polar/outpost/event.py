import collections.abc
import dataclasses
import datetime
import typing

import typing_extensions

{% for api in ir.versions %}
from polar.{{ api | format_version }}.inputs import EventCreateCustomer as EventCreateCustomer{{ api | format_version }}, EventCreateExternalCustomer as EventCreateExternalCustomer{{ api | format_version }}
{% endfor %}

EventInput: typing.TypeAlias = typing.Union[
    {% for api in ir.versions %}
    EventCreateCustomer{{ api | format_version }},
    EventCreateExternalCustomer{{ api | format_version }},
    {% endfor %}
]

@dataclasses.dataclass
class Event:
    name: str
    external_customer_id: str
    timestamp: datetime.datetime
    metadata: typing_extensions.Mapping[typing.Any, typing.Any] = dataclasses.field(default_factory=dict)

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
                    if not isinstance(value, dict):
                        return None
                    value = value.get(part)
                return value
