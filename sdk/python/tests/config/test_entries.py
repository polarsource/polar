import pytest

from polar.config import Config, Meter, MeterSet


class Meters(MeterSet):
    tool_call = Meter("Tool calls", on="tool_call")
    tokens = Meter("Output tokens", on="llm.completion")


TOOL_CALL = {
    "external_id": "tool_call",
    "name": "Tool calls",
    "filter": {
        "conjunction": "and",
        "clauses": [{"property": "name", "operator": "eq", "value": "tool_call"}],
    },
    "aggregation": {"func": "count"},
}


def test_subclassed_set_keeps_inherited_meters() -> None:
    class Extended(Meters):
        requests = Meter("Requests", on="request")

    meters = Config(meters=Extended).to_dict()["meters"]

    assert [meter["external_id"] for meter in meters] == [
        "tool_call",
        "tokens",
        "requests",
    ]


def test_explicit_external_id() -> None:
    class Dashed(MeterSet):
        tool_calls = Meter("Tool calls", on="tool_call", external_id="tool-calls")

    assert Config(meters=Dashed).to_dict() == {
        "meters": [{**TOOL_CALL, "external_id": "tool-calls"}]
    }


def test_rejects_an_attribute_python_renames() -> None:
    class Private(MeterSet):
        __calls = Meter("Calls", on="call")

    with pytest.raises(ValueError, match=r"Private\.__calls"):
        Config(meters=Private).to_dict()
