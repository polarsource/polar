import collections.abc
import dataclasses
import datetime
import typing

import typing_extensions


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


PropertyReader: typing.TypeAlias = collections.abc.Callable[[Event], typing.Any]


def get_property_reader(property: str) -> PropertyReader:
    match property:
        case "name":
            return lambda event: event.name
        case "source":
            return lambda event: "user"
        case "timestamp":
            return lambda event: int(event.timestamp.timestamp())
    path = property.removeprefix("metadata.").split(".")

    def read(event: Event) -> typing.Any:
        value: typing.Any = event.metadata
        for part in path:
            # Metadata is almost always a dict: checking its type first is cheaper
            # than isinstance against collections.abc.Mapping.
            if type(value) is not dict and not isinstance(
                value, collections.abc.Mapping
            ):
                return None
            value = value.get(part)
        return value

    return read
