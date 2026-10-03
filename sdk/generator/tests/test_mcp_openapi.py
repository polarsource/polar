import json
import pathlib
import typing

from generator.mcp_openapi import generate_mcp_openapi


def test_generate_mcp_openapi_removes_private_operations(
    tmp_path: pathlib.Path,
) -> None:
    schema: dict[str, typing.Any] = {
        "openapi": "3.1.0",
        "info": {"title": "Test", "version": "2026-04"},
        "paths": {
            "/public": {"get": {"tags": ["public"]}},
            "/private": {"get": {"tags": ["private"]}},
        },
    }
    source_path = tmp_path / "source.json"
    output_path = tmp_path / "output"
    source_path.write_text(json.dumps(schema), encoding="utf-8")

    generate_mcp_openapi([source_path], output_path)

    output = json.loads((output_path / source_path.name).read_text(encoding="utf-8"))
    assert "/public" in output["paths"]
    assert "/private" not in output["paths"]
