import pathlib
import runpy
import typing

import pytest

from polar.config import Config
from polar.config.render import render


def event(name: str) -> dict[str, typing.Any]:
    return {"property": "name", "operator": "eq", "value": name}


TOOL_CALL: dict[str, typing.Any] = {
    "external_id": "tool_call",
    "name": "Tool calls",
    "unit": "scalar",
    "custom_label": None,
    "custom_multiplier": None,
    "filter": {"conjunction": "and", "clauses": [event("tool_call")]},
    "aggregation": {"func": "count"},
    "metadata": {},
}
TOKENS = {
    **TOOL_CALL,
    "external_id": "tokens",
    "name": "Output tokens",
    "unit": "token",
    "filter": {
        "conjunction": "and",
        "clauses": [
            event("llm.completion"),
            {"property": "status", "operator": "eq", "value": "ok"},
        ],
    },
    "aggregation": {"func": "sum", "property": "output_tokens"},
}
SLOW_REQUESTS = {
    **TOOL_CALL,
    "external_id": "slow_requests",
    "name": 'Slow "requests" \\ day',
    "unit": "custom",
    "custom_label": "requests",
    "custom_multiplier": 1000,
    "filter": {
        "conjunction": "and",
        "clauses": [
            event("request"),
            {"property": "duration", "operator": "gt", "value": 500},
            {
                "conjunction": "or",
                "clauses": [
                    {"property": "status", "operator": "eq", "value": "error"},
                    {"property": "path", "operator": "not_like", "value": "/health%"},
                    {"property": "cached", "operator": "ne", "value": True},
                ],
            },
        ],
    },
    "aggregation": {"func": "unique", "property": "user_id"},
    "metadata": {"team": "core", "tier": 2, "ratio": 0.5, "beta": True},
}

RENDERED = """\
from polar.config import (
    Config,
    Meter,
    MeterSet,
    Sum,
    Unique,
    and_,
    eq,
    gt,
    ne,
    not_like,
    or_,
)


class Meters(MeterSet):
    tool_call = Meter("Tool calls", on="tool_call")
    tokens = Meter(
        "Output tokens",
        on="llm.completion",
        where=eq("status", "ok"),
        aggregate=Sum("output_tokens"),
        unit="token",
    )
    slow_requests = Meter(
        'Slow "requests" \\\\ day',
        on="request",
        where=and_(
            gt("duration", 500),
            or_(
                eq("status", "error"),
                not_like("path", "/health%"),
                ne("cached", True),
            ),
        ),
        aggregate=Unique("user_id"),
        unit="custom",
        custom_label="requests",
        custom_multiplier=1000,
        metadata={"team": "core", "tier": 2, "ratio": 0.5, "beta": True},
    )


config = Config(meters=Meters)
"""


def test_writes_meters_the_way_ruff_formats_them() -> None:
    assert render({"meters": [TOOL_CALL, TOKENS, SLOW_REQUESTS]}) == RENDERED


def test_written_config_declares_the_same_meters(tmp_path: pathlib.Path) -> None:
    file = tmp_path / "polar_config.py"
    file.write_text(render({"meters": [TOOL_CALL, TOKENS, SLOW_REQUESTS]}))
    config = runpy.run_path(str(file))["config"]

    assert isinstance(config, Config)
    assert config.to_dict() == {
        "meters": [
            {
                key: value
                for key, value in meter.items()
                if value not in (None, {}, "scalar")
            }
            for meter in (TOOL_CALL, TOKENS, SLOW_REQUESTS)
        ]
    }


def test_writes_an_empty_set_without_meters() -> None:
    assert render({"meters": []}) == (
        "from polar.config import Config, MeterSet\n\n\n"
        "class Meters(MeterSet):\n    pass\n\n\n"
        "config = Config(meters=Meters)\n"
    )


@pytest.mark.parametrize(
    "meter",
    [
        {**TOOL_CALL, "external_id": "tool-call"},
        {**TOOL_CALL, "external_id": "class"},
        {**TOOL_CALL, "external_id": "__tool_call"},
        {**TOOL_CALL, "new_field": "value"},
        {
            **TOOL_CALL,
            "filter": {
                "conjunction": "or",
                "clauses": [event("tool_call"), event("llm_call")],
            },
        },
        {
            **TOOL_CALL,
            "filter": {
                "conjunction": "and",
                "clauses": [
                    event("tool_call"),
                    {
                        "conjunction": "and",
                        "clauses": [
                            {"property": "ok", "operator": "eq", "value": True}
                        ],
                    },
                ],
            },
        },
    ],
    ids=[
        "an external ID with a dash",
        "a Python keyword as external ID",
        "an external ID Python would rename inside a class",
        "a field the config does not know",
        "several events",
        "conditions the meter would merge into the event filter",
    ],
)
def test_refuses_a_meter_it_cannot_express(meter: dict[str, typing.Any]) -> None:
    with pytest.raises(ValueError, match=f"The meter {meter['external_id']} has"):
        render({"meters": [meter]})
