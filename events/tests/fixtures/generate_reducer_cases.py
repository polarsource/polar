"""Regenerate reducer_cases.json from the Python filter and aggregation:

cd server && PYTHONPATH=. uv run python ../events/tests/fixtures/generate_reducer_cases.py
"""

import itertools
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from polar.meter.aggregation import AggregationTypeAdapter
from polar.meter.filter import Filter
from polar.models import Event
from polar.models.event import EventSource

EVENT = {
    "name": "api.call",
    "timestamp": "2025-01-01T00:00:00.750000+00:00",
    "metadata": {
        "model": "gpt-5",
        "tokens": 12,
        "ratio": 1.5,
        "whole": 2.0,
        "cached": True,
        "disabled": False,
        "empty": "",
        "numeric_text": "12",
        "unicode": "héllo wörld",
        "_llm": {"vendor": "v", "model": "m", "prompt": None, "input_tokens": 7},
        "_cost": {"amount": 0.25, "currency": "usd"},
    },
}
PROPERTIES = [
    "name",
    "source",
    "timestamp",
    "model",
    "metadata.model",
    "tokens",
    "ratio",
    "whole",
    "cached",
    "disabled",
    "empty",
    "numeric_text",
    "unicode",
    "missing",
    "_llm",
    "_llm.input_tokens",
    "_llm.prompt",
    "_llm.vendor.nested",
    "_cost.amount",
    "metadata.metadata.model",
    "",
]
OPERATORS = ["eq", "ne", "gt", "gte", "lt", "lte", "like", "not_like"]
VALUES: list[Any] = [
    "api.call",
    "api",
    "user",
    "gpt-5",
    "gpt",
    "",
    "12",
    "wör",
    "z",
    12,
    11,
    13,
    2,
    1,
    0,
    1735689600,
    1735689601,
    True,
    False,
]
AGGREGATIONS: list[dict[str, Any]] = [
    {"func": "count"},
    {"func": "unique", "property": "model"},
    *(
        {"func": func, "property": property}
        for func in ("sum", "max", "min", "avg")
        for property in PROPERTIES
    ),
]
GROUPS: list[dict[str, Any]] = [
    {"conjunction": "and", "clauses": []},
    {"conjunction": "or", "clauses": []},
    *(
        {
            "conjunction": conjunction,
            "clauses": [
                {"property": "name", "operator": "eq", "value": name},
                {
                    "conjunction": nested,
                    "clauses": [
                        {"property": "tokens", "operator": "gt", "value": tokens},
                        {"property": "cached", "operator": "eq", "value": cached},
                    ],
                },
            ],
        }
        for conjunction, nested in itertools.product(("and", "or"), repeat=2)
        for name in ("api.call", "other")
        for tokens in (5, 50)
        for cached in (True, False)
    ),
]


event = Event(
    name=EVENT["name"],
    source=EventSource.user,
    timestamp=datetime.fromisoformat(EVENT["timestamp"]).astimezone(UTC),
    user_metadata=EVENT["metadata"],
)


def matches(filter: dict[str, Any]) -> bool:
    return Filter.model_validate(filter).matches(event)


def lines(items: list[Any]) -> str:
    return "[\n" + ",\n".join("  " + json.dumps(item) for item in items) + "\n ]"


output = {
    "event": json.dumps(EVENT),
    "properties": json.dumps(PROPERTIES),
    "operators": json.dumps(OPERATORS),
    "values": json.dumps(VALUES),
    # One row per property, with one character per operator and value pair, in
    # order: 1 when the event matches the clause.
    "matches": lines(
        [
            "".join(
                "1"
                if matches(
                    {
                        "conjunction": "and",
                        "clauses": [
                            {"property": property, "operator": operator, "value": value}
                        ],
                    }
                )
                else "0"
                for operator in OPERATORS
                for value in VALUES
            )
            for property in PROPERTIES
        ]
    ),
    "groups": lines([{"filter": group, "matches": matches(group)} for group in GROUPS]),
    "aggregations": lines(
        [
            {
                "aggregation": aggregation,
                "value": getattr(
                    AggregationTypeAdapter.validate_python(aggregation),
                    "get_value",
                    lambda event: None,
                )(event),
            }
            for aggregation in AGGREGATIONS
        ]
    ),
}
path = Path(__file__).parent / "reducer_cases.json"
path.write_text(
    "{\n"
    + ",\n".join(f" {json.dumps(key)}: {value}" for key, value in output.items())
    + "\n}\n"
)
