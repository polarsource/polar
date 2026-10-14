import collections
import collections.abc
import datetime
import types
import typing

import pytest

from polar.outpost.event import Event

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

    assert event.get_property("metadata.nested.value") == 42
    assert event.get_property("nested.value") == 42
    assert event.get_property("metadata.nested.missing") is None
    assert event.get_property("metadata.nested.value.child") is None


def test_naive_timestamp_is_rejected() -> None:
    with pytest.raises(ValueError, match="timezone"):
        Event("call", "customer", TIMESTAMP.replace(tzinfo=None))
