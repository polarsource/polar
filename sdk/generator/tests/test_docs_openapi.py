import json
import pathlib
import typing

from generator.docs_openapi import (
    DATETIME_EXAMPLE,
    apply_overlay,
    generate_datetime_examples_overlay,
    generate_private_operations_overlay,
)


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


def test_datetime_examples_overlay_adds_examples_with_fractional_seconds(
    tmp_path: pathlib.Path,
) -> None:
    schema: dict[str, typing.Any] = {
        "openapi": "3.1.0",
        "info": {"title": "Test", "version": "2026-04"},
        "components": {
            "schemas": {
                "Order": {
                    "properties": {
                        "created_at": {"type": "string", "format": "date-time"},
                        "modified_at": {
                            "anyOf": [
                                {"type": "string", "format": "date-time"},
                                {"type": "null"},
                            ]
                        },
                        "started_at": {
                            "type": "string",
                            "format": "date-time",
                            "examples": ["2025-01-03T13:37:00Z"],
                        },
                        "amount": {"type": "integer"},
                        "items": {
                            "type": "array",
                            "items": {
                                "properties": {
                                    "period_end": {
                                        "type": "string",
                                        "format": "date-time",
                                    }
                                }
                            },
                        },
                    }
                }
            }
        },
    }
    overlay = generate_datetime_examples_overlay(schema)
    source_path = tmp_path / "source.json"
    overlay_path = tmp_path / "overlay.json"
    output_path = tmp_path / "output.json"
    source_path.write_text(json.dumps(schema), encoding="utf-8")
    overlay_path.write_text(json.dumps(overlay), encoding="utf-8")

    apply_overlay(source_path, overlay_path, output_path)

    output = json.loads(output_path.read_text(encoding="utf-8"))
    properties = output["components"]["schemas"]["Order"]["properties"]
    assert properties["created_at"]["examples"] == [DATETIME_EXAMPLE]
    assert properties["modified_at"]["examples"] == [DATETIME_EXAMPLE]
    assert "examples" not in properties["modified_at"]["anyOf"][0]
    assert properties["started_at"]["examples"] == ["2025-01-03T13:37:00Z"]
    assert "examples" not in properties["amount"]
    assert properties["items"]["items"]["properties"]["period_end"]["examples"] == [
        DATETIME_EXAMPLE
    ]


def test_datetime_examples_overlay_targets_component_schemas_only() -> None:
    schema = {
        "info": {"version": "2026-04"},
        "paths": {
            "/orders": {
                "get": {
                    "parameters": [
                        {
                            "name": "since",
                            "in": "query",
                            "schema": {"type": "string", "format": "date-time"},
                        }
                    ]
                }
            }
        },
        "components": {
            "schemas": {
                "Order": {
                    "properties": {
                        "created_at": {"type": "string", "format": "date-time"}
                    }
                }
            }
        },
    }

    overlay = generate_datetime_examples_overlay(schema)

    assert overlay["actions"] == [
        {
            "target": '$["components"]["schemas"]["Order"]["properties"]["created_at"]',
            "update": {"examples": [DATETIME_EXAMPLE]},
        }
    ]
