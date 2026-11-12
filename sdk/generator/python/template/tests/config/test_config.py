import json
import pathlib
import subprocess
import sys
import typing

import pytest

from polar.config import (
    Aggregation,
    Avg,
    Condition,
    Config,
    Count,
    Max,
    Meter,
    MeterSet,
    Min,
    Sum,
    Unique,
    and_,
    eq,
    gt,
    gte,
    like,
    lt,
    lte,
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


TOOL_CALL = {
    "external_id": "tool_call",
    "name": "Tool calls",
    "filter": {
        "conjunction": "and",
        "clauses": [{"property": "name", "operator": "eq", "value": "tool_call"}],
    },
    "aggregation": {"func": "count"},
}
REQUEST = {"property": "name", "operator": "eq", "value": "request"}
SLOW = {"property": "duration", "operator": "gt", "value": 500}
FAILED = {"property": "status", "operator": "eq", "value": "error"}


def test_config_to_dict() -> None:
    assert Config(meters=Meters).to_dict() == {
        "meters": [
            TOOL_CALL,
            {
                "external_id": "tokens",
                "name": "Output tokens",
                "filter": {
                    "conjunction": "and",
                    "clauses": [
                        {
                            "property": "name",
                            "operator": "eq",
                            "value": "llm.completion",
                        },
                        {"property": "status", "operator": "eq", "value": "ok"},
                    ],
                },
                "aggregation": {"func": "sum", "property": "output_tokens"},
                "unit": "token",
            },
        ]
    }


def test_config_without_meters() -> None:
    assert Config().to_dict() == {"meters": []}


def test_subclassed_set_keeps_inherited_meters() -> None:
    class Extended(Meters):
        requests = Meter("Requests", on="request")

    meters = Config(meters=Extended).to_dict()["meters"]

    assert [meter["external_id"] for meter in meters] == [
        "tool_call",
        "tokens",
        "requests",
    ]


@pytest.mark.parametrize(
    ("compare", "operator"),
    [
        (eq, "eq"),
        (ne, "ne"),
        (gt, "gt"),
        (gte, "gte"),
        (lt, "lt"),
        (lte, "lte"),
        (like, "like"),
        (not_like, "not_like"),
    ],
)
def test_comparisons(
    compare: typing.Callable[[str, int], Condition], operator: str
) -> None:
    assert compare("duration", 500) == {
        "property": "duration",
        "operator": operator,
        "value": 500,
    }


@pytest.mark.parametrize(
    ("aggregation", "expected"),
    [
        (Count(), {"func": "count"}),
        (Sum("tokens"), {"func": "sum", "property": "tokens"}),
        (Max("tokens"), {"func": "max", "property": "tokens"}),
        (Min("tokens"), {"func": "min", "property": "tokens"}),
        (Avg("tokens"), {"func": "avg", "property": "tokens"}),
        (Unique("user"), {"func": "unique", "property": "user"}),
    ],
)
def test_aggregations(aggregation: Aggregation, expected: dict[str, str]) -> None:
    assert aggregation == expected


@pytest.mark.parametrize(
    ("where", "clauses"),
    [
        (and_(gt("duration", 500), eq("status", "error")), [REQUEST, SLOW, FAILED]),
        (
            or_(gt("duration", 500), eq("status", "error")),
            [REQUEST, {"conjunction": "or", "clauses": [SLOW, FAILED]}],
        ),
    ],
)
def test_where_joins_the_event_filter(where: Condition, clauses: list[object]) -> None:
    meter = Meter("Requests", on="request", where=where)

    assert meter.filter == {"conjunction": "and", "clauses": clauses}


def test_load_prints_only_the_config_as_json(tmp_path: pathlib.Path) -> None:
    (tmp_path / "meters.py").write_text(
        "from polar.config import Meter, MeterSet\n\n\n"
        "class Meters(MeterSet):\n"
        '    tool_call = Meter("Tool calls", on="tool_call")\n'
    )
    file = tmp_path / "polar_config.py"
    file.write_text(
        "from meters import Meters\n\n"
        "from polar.config import Config\n\n"
        'print("loading")\n'
        "config = Config(meters=Meters)\n"
    )

    result = subprocess.run(
        [sys.executable, "-m", "polar.config", "load", str(file)],
        capture_output=True,
        text=True,
        check=True,
    )

    assert json.loads(result.stdout) == {"meters": [TOOL_CALL]}


def test_load_requires_a_config_variable(tmp_path: pathlib.Path) -> None:
    file = tmp_path / "polar_config.py"
    file.write_text("meters = []\n")

    result = subprocess.run(
        [sys.executable, "-m", "polar.config", "load", str(file)],
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 1
    assert "named `config`" in result.stderr
