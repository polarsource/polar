import json
import pathlib

import pytest

from generator.openapi import generate_openapi


def test_generate_openapi(
    monkeypatch: pytest.MonkeyPatch, tmp_path: pathlib.Path
) -> None:
    commands: list[tuple[str, ...]] = []

    def run_openapi_generator(*arguments: str) -> str:
        commands.append(arguments)
        if arguments == ("versions",):
            return "2026-04\n2026-10\n"
        return json.dumps({"info": {"version": arguments[1]}})

    monkeypatch.setattr(
        "generator.openapi._run_openapi_generator", run_openapi_generator
    )
    output = tmp_path / "openapi"

    generate_openapi(output)

    assert commands == [
        ("versions",),
        ("generate", "2026-04"),
        ("generate", "2026-10"),
    ]
    assert sorted(path.name for path in output.iterdir()) == [
        "2026-04.openapi.json",
        "2026-10.openapi.json",
    ]
    assert json.loads((output / "2026-04.openapi.json").read_text()) == {
        "info": {"version": "2026-04"}
    }
