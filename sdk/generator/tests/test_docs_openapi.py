import json
import pathlib
import typing

from generator.docs_openapi import apply_overlay, generate_private_operations_overlay


def test_private_operations_overlay_removes_private_operations(
    tmp_path: pathlib.Path,
) -> None:
    schema: dict[str, typing.Any] = {
        "openapi": "3.1.0",
        "info": {"title": "Test", "version": "2026-04"},
        "paths": {
            "/public": {"get": {"tags": ["public"]}},
            "/private": {"get": {"tags": ["private"]}},
            "/mixed": {
                "get": {"tags": ["public"]},
                "post": {"tags": ["private"]},
            },
        },
        "webhooks": {
            "public.event": {"post": {"tags": ["webhooks"]}},
            "private.event": {"post": {"tags": ["private"]}},
        },
    }
    overlay = generate_private_operations_overlay(schema)
    source_path = tmp_path / "source.json"
    overlay_path = tmp_path / "overlay.json"
    output_path = tmp_path / "output.json"
    source_path.write_text(json.dumps(schema), encoding="utf-8")
    overlay_path.write_text(json.dumps(overlay), encoding="utf-8")

    apply_overlay(source_path, overlay_path, output_path)

    output = json.loads(output_path.read_text(encoding="utf-8"))
    assert "/public" in output["paths"]
    assert "/private" not in output["paths"]
    assert output["paths"]["/mixed"] == {"get": {"tags": ["public"]}}
    assert "public.event" in output["webhooks"]
    assert "private.event" not in output["webhooks"]


def test_private_operations_overlay_ignores_path_metadata() -> None:
    schema = {
        "info": {"version": "2026-04"},
        "paths": {
            "/private": {
                "parameters": [{"name": "id", "in": "path"}],
                "get": {"tags": ["private"]},
            }
        },
    }

    overlay = generate_private_operations_overlay(schema)

    assert overlay["actions"] == [{"target": '$["paths"]["/private"]', "remove": True}]
