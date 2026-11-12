import pathlib
import runpy

import pytest

from polar.config.source import MODULE, Positions, positions

CONFIG = """\
from shared import Shared

from polar.config import Config, Meter, Sum, eq

BETA = True


class Meters(Shared):
    where = Meter('external_id="x" ö', on="a")
    tokens = Meter(
        "Output tokens",
        on="llm.completion",
        where=eq("status", "ok"),  # on="decoy"
        aggregate=Sum("output_tokens"),
        unit="token",
    )
    if BETA:
        beta = Meter("Beta", on="beta")


config = Config(
  meters=Meters,
)
"""

SHARED = """\
from polar.config import Meter, MeterSet


class Shared(MeterSet):
    inherited = Meter("Inherited", on="x")
"""


@pytest.fixture
def found(tmp_path: pathlib.Path, monkeypatch: pytest.MonkeyPatch) -> Positions:
    (tmp_path / "shared.py").write_text(SHARED)
    file = tmp_path / "polar_config.py"
    file.write_text(CONFIG)
    monkeypatch.syspath_prepend(str(tmp_path))
    config = runpy.run_path(str(file), run_name=MODULE)["config"]
    return positions(config, file)


def test_lists_entries_in_the_order_of_the_config(found: Positions) -> None:
    names = [entry and entry["name"] for entry in found["entries"]["meters"]]

    assert names == [
        None,
        {"line": 9, "column": 5, "length": 5},
        {"line": 10, "column": 5, "length": 6},
        {"line": 18, "column": 9, "length": 4},
    ]


def test_maps_arguments_to_the_fields_of_the_api(found: Positions) -> None:
    tokens = found["entries"]["meters"][2]

    assert tokens is not None
    assert tokens["fields"] == {
        "name": {
            "key": {"line": 11, "column": 9, "length": 15},
            "values": [
                {
                    "value": "Output tokens",
                    "span": {"line": 11, "column": 9, "length": 15},
                }
            ],
        },
        "filter": {
            "key": {"line": 12, "column": 9, "length": 2},
            "values": [
                {
                    "value": "llm.completion",
                    "span": {"line": 12, "column": 12, "length": 16},
                },
                {"value": "status", "span": {"line": 13, "column": 18, "length": 8}},
                {"value": "ok", "span": {"line": 13, "column": 28, "length": 4}},
            ],
        },
        "aggregation": {
            "key": {"line": 14, "column": 9, "length": 9},
            "values": [
                {
                    "value": "output_tokens",
                    "span": {"line": 14, "column": 23, "length": 15},
                }
            ],
        },
        "unit": {
            "key": {"line": 15, "column": 9, "length": 4},
            "values": [
                {"value": "token", "span": {"line": 15, "column": 14, "length": 7}}
            ],
        },
    }


def test_counts_characters_and_reads_strings_as_values(found: Positions) -> None:
    where = found["entries"]["meters"][1]

    assert where is not None
    assert where["fields"] == {
        "name": {
            "key": {"line": 9, "column": 19, "length": 19},
            "values": [
                {
                    "value": 'external_id="x" ö',
                    "span": {"line": 9, "column": 19, "length": 19},
                }
            ],
        },
        "filter": {
            "key": {"line": 9, "column": 40, "length": 2},
            "values": [{"value": "a", "span": {"line": 9, "column": 43, "length": 3}}],
        },
    }


def test_finds_a_section_where_config_receives_it(found: Positions) -> None:
    assert found["sections"] == {"meters": {"line": 22, "column": 3, "length": 6}}
