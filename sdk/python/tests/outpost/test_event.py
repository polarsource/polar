import collections
import collections.abc
import datetime
import types
import typing

import pytest

from polar.outpost.event import Event, get_property_reader

TIMESTAMP = datetime.datetime(2026, 10, 12, 12, 4, 59, tzinfo=datetime.UTC)


@pytest.mark.parametrize(
    "mapping_type", [dict, collections.UserDict, types.MappingProxyType]
)
def test_metadata_mapping_traversal(
    mapping_type: typing.Callable[..., collections.abc.Mapping[str, typing.Any]],
) -> None:
    event = Event(
        "call",
        "customer",
        TIMESTAMP,
        mapping_type({"nested": mapping_type({"value": 42})}),
    )

    assert get_property_reader("metadata.nested.value")(event) == 42
    assert get_property_reader("nested.value")(event) == 42
    assert get_property_reader("metadata.nested.missing")(event) is None
    assert get_property_reader("metadata.nested.value.child")(event) is None


def test_naive_timestamp_is_rejected() -> None:
    with pytest.raises(ValueError, match="timezone"):
        Event("call", "customer", TIMESTAMP.replace(tzinfo=None))
