import json
import pathlib
import subprocess
import sys

import pytest

from polar.config import Config, Meter, MeterSet, eq


def run_module(
    directory: pathlib.Path, source: str
) -> subprocess.CompletedProcess[str]:
    file = directory / "polarfile.py"
    file.write_text(source)
    return subprocess.run(
        [sys.executable, "-m", "polar.config", str(file)],
        check=False,
        capture_output=True,
        text=True,
        cwd=directory,
    )


class Meters(MeterSet):
    tool_call = Meter("Tool calls", on="tool_call", unit="custom", label="tool calls")


def test_config_compiles_to_the_json_the_api_accepts() -> None:
    assert json.loads(Config(meters=Meters).to_json()) == {
        "meters": [
            {
                "external_id": "tool_call",
                "name": "Tool calls",
                "filter": {
                    "conjunction": "and",
                    "clauses": [
                        {"property": "name", "operator": "eq", "value": "tool_call"}
                    ],
                },
                "aggregation": {"func": "count"},
                "unit": "custom",
                "custom_label": "tool calls",
            }
        ]
    }


def test_attribute_names_become_external_ids_unless_overridden() -> None:
    class Usage(MeterSet):
        calls = Meter(on="call")
        legacy = Meter(on="old", external_id="legacy-meter")

    assert [meter.id for meter in Usage.definitions()] == ["calls", "legacy-meter"]
    assert Config(meters=Usage).to_dict()["meters"][0]["name"] == "calls"


def test_sets_reject_anything_but_their_definitions() -> None:
    with pytest.raises(TypeError, match="Usage.calls must be a Meter, got str"):

        class Usage(MeterSet):
            calls = "tool_call"


def test_meters_aggregate_one_property_and_narrow_with_where() -> None:
    tokens = Meter("Tokens", on="tool_call", where=eq("success", True), sum="tokens")
    assert tokens.aggregation == {"func": "sum", "property": "tokens"}
    assert tokens.filter == {
        "conjunction": "and",
        "clauses": [
            {"property": "name", "operator": "eq", "value": "tool_call"},
            {"property": "success", "operator": "eq", "value": True},
        ],
    }
    with pytest.raises(ValueError, match="only one of sum, max"):
        Meter("Bad", on="x", sum="a", max="b")


def test_short_attribute_names_need_a_name() -> None:
    class Usage(MeterSet):
        ok = Meter(on="x")

    with pytest.raises(ValueError, match='Provide a name for meter "ok"'):
        Config(meters=Usage)


def test_module_prints_the_config(tmp_path: pathlib.Path) -> None:
    ran = run_module(tmp_path, "from polar.config import Config\nconfig = Config()\n")

    assert ran.returncode == 0, ran.stderr
    assert json.loads(ran.stdout) == {"meters": []}


def test_module_explains_a_file_without_a_config(tmp_path: pathlib.Path) -> None:
    ran = run_module(tmp_path, "billing = {}\n")

    assert ran.returncode == 1
    assert "variable named `config`" in ran.stderr
