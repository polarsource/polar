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
        return json.dumps(
            {
                "2026-04": {"info": {"version": "2026-04"}},
                "2026-10": {"info": {"version": "2026-10"}},
            }
        )

    monkeypatch.setattr(
        "generator.openapi._run_openapi_generator", run_openapi_generator
    )
    output = tmp_path / "openapi"

    generate_openapi(output)

    assert commands == [("generate-all",)]
    assert sorted(path.name for path in output.iterdir()) == [
        "2026-04.openapi.json",
        "2026-10.openapi.json",
    ]
    assert json.loads((output / "2026-04.openapi.json").read_text()) == {
        "info": {"version": "2026-04"}
    }
