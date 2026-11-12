import json
import pathlib
import subprocess
import sys

from polar.config import Config, Meter, MeterSet, Sum, eq


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
