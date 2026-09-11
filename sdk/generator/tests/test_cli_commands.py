import pathlib
import typing

import openapi_pydantic as op
import pytest

from cli_commands.emitter import CLICommandsEmitter
from cli_commands.ir import generate_cli_ir
from generator.ir import CLIConfirmation, generate_ir


@pytest.fixture
def cli_spec() -> dict:
    spec: dict = {
        "openapi": "3.1.0",
        "info": {"title": "Widgets", "version": "2026-04"},
        "paths": {
            "/widgets/{id}": {
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": True,
                        "schema": {"type": "string"},
                    },
                ],
                "get": {
                    "operationId": "widgets:get",
                    "tags": ["cli"],
                    "x-polar-cli-preview": {
                        "fields": [
                            {"key": "id", "label": "ID"},
                            {"key": "name", "label": "Name"},
                        ]
                    },
                    "responses": {
                        "200": {
                            "description": "Widget",
                            "content": {
                                "application/json": {
                                    "schema": {"$ref": "#/components/schemas/Widget"},
                                }
                            },
                        }
                    },
                },
                "patch": {
                    "operationId": "widgets:update",
                    "tags": ["cli"],
                    "requestBody": {
                        "required": True,
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/WidgetUpdate"},
                            },
                        },
                    },
                    "responses": {"204": {"description": "Updated"}},
                },
                "delete": {
                    "operationId": "widgets:delete",
                    "tags": ["cli"],
                    "responses": {"204": {"description": "Deleted"}},
                },
            },
        },
        "components": {
            "schemas": {
                "Widget": {
                    "type": "object",
                    "required": ["id", "name"],
                    "properties": {
                        "id": {"type": "string"},
                        "name": {"type": "string"},
                        "metadata": {"type": "object", "additionalProperties": True},
                    },
                },
                "WidgetUpdate": {
                    "type": "object",
                    "properties": {
                        "is_archived": {
                            "anyOf": [{"type": "boolean"}, {"type": "null"}],
                            "x-polar-cli-confirm": {"equals": True},
                        },
                    },
                },
            }
        },
    }

    path: dict[str, typing.Any] = spec["paths"]["/widgets/{id}"]
    parameters = path.pop("parameters")
    for operation in path.values():
        operation["parameters"] = parameters
    return spec


@pytest.mark.parametrize(
    ("tags", "included"),
    [
        (["cli"], True),
        (["public", "cli", "mcp"], True),
        (["mcp"], False),
        (["public"], False),
        (["private", "cli"], False),
        (None, False),
    ],
)
def test_cli_tags_select_operations_without_changing_sdk_selection(
    tags: list[str] | None, included: bool, tmp_path: pathlib.Path
) -> None:
    spec = op.OpenAPI.model_validate(
        {
            "openapi": "3.1.0",
            "info": {"title": "Tag selection", "version": "2026-04"},
            "paths": {
                "/widgets/": {
                    "get": {
                        "operationId": "widgets:list",
                        "tags": ["cli"],
                        "responses": {"204": {"description": "OK"}},
                    },
                    "post": {
                        "operationId": "widgets:create",
                        "tags": tags,
                        "responses": {"204": {"description": "OK"}},
                    },
                }
            },
        }
    )
    CLICommandsEmitter(generate_cli_ir(spec)).emit(tmp_path)
    assert (tmp_path / "src/widgets/list.ts").exists()
    assert (tmp_path / "src/widgets/create.ts").exists() == included
    sdk_methods = {m.name for m in generate_ir(spec).versions[0].services[0].methods}
    assert ("create" in sdk_methods) == ("private" not in (tags or []))


def test_regeneration_is_deterministic_and_removes_stale_commands(
    cli_spec: dict, tmp_path: pathlib.Path
) -> None:
    emitter = CLICommandsEmitter(generate_cli_ir(op.OpenAPI.model_validate(cli_spec)))
    emitter.emit(tmp_path)
    original = {
        p.relative_to(tmp_path): p.read_bytes()
        for p in tmp_path.rglob("*")
        if p.is_file()
    }
    (tmp_path / "src/widgets/stale.ts").write_text("stale")
    (tmp_path / "src/stale_resource").mkdir()
    (tmp_path / "src/stale_resource/index.ts").write_text("stale")
    emitter.emit(tmp_path)
    assert {
        p.relative_to(tmp_path): p.read_bytes()
        for p in tmp_path.rglob("*")
        if p.is_file()
    } == original


def test_confirmation_uses_merged_input(cli_spec: dict, tmp_path: pathlib.Path) -> None:
    CLICommandsEmitter(generate_cli_ir(op.OpenAPI.model_validate(cli_spec))).emit(
        tmp_path
    )
    source = (tmp_path / "src/widgets/update.ts").read_text()
    assert "Schema.optionalKey(Schema.NullOr(Schema.Boolean))" in source
    assert 'requiresConfirmation: confirmationInput["is_archived"] === true' in source
    assert "confirm: config.confirm" in source
    assert "client.widgets.get(config.path.id)" in source
    assert source.index("mergeInput<Body>") < source.index("Schema.decodeUnknownEffect")
    assert (
        "requiresConfirmation: true" in (tmp_path / "src/widgets/delete.ts").read_text()
    )
    assert "confirm: false" in (tmp_path / "src/widgets/get.ts").read_text()


@pytest.mark.parametrize("value", ["true", 1])
def test_confirmation_value_must_match_field_schema(
    cli_spec: dict, tmp_path: pathlib.Path, value: str | int
) -> None:
    cli_spec["components"]["schemas"]["WidgetUpdate"]["properties"]["is_archived"][
        "x-polar-cli-confirm"
    ] = {"equals": value}
    with pytest.raises(ValueError, match="does not match its schema"):
        CLICommandsEmitter(generate_cli_ir(op.OpenAPI.model_validate(cli_spec))).emit(
            tmp_path
        )


@pytest.mark.parametrize(
    "annotation",
    [
        {},
        {"equals": []},
        {"equals": {}},
        {"one_of": []},
        {"equals": True, "one_of": [False]},
    ],
)
def test_malformed_confirmation_annotations_fail(
    cli_spec: dict, annotation: dict
) -> None:
    cli_spec["components"]["schemas"]["WidgetUpdate"]["properties"]["is_archived"][
        "x-polar-cli-confirm"
    ] = annotation
    with pytest.raises(ValueError, match="equals"):
        generate_cli_ir(op.OpenAPI.model_validate(cli_spec))


def test_confirmation_rules_round_trip() -> None:
    for rule in [
        CLIConfirmation(equals=None),
        CLIConfirmation(equals=False),
        CLIConfirmation(one_of=["revoked", "disabled"]),
    ]:
        restored = CLIConfirmation.model_validate_json(rule.model_dump_json())
        assert restored.values == rule.values


def test_delete_preview_uses_matching_get_and_field_order(
    cli_spec: dict, tmp_path: pathlib.Path
) -> None:
    CLICommandsEmitter(generate_cli_ir(op.OpenAPI.model_validate(cli_spec))).emit(
        tmp_path
    )
    source = (tmp_path / "src/widgets/delete.ts").read_text()
    assert "invoke: (client) => client.widgets.get(config.path.id)," in source
    assert 'key: "id", label: "ID"' in source
    assert source.index('key: "id"') < source.index('key: "name"')


@pytest.mark.parametrize("tags", [["public", "mcp"], ["private", "cli"]])
def test_preview_get_must_be_cli_eligible(
    cli_spec: dict, tmp_path: pathlib.Path, tags: list[str]
) -> None:
    cli_spec["paths"]["/widgets/{id}"]["get"]["tags"] = tags
    CLICommandsEmitter(generate_cli_ir(op.OpenAPI.model_validate(cli_spec))).emit(
        tmp_path
    )
    assert "preview:" not in (tmp_path / "src/widgets/delete.ts").read_text()


@pytest.mark.parametrize("keys", [[], ["id", "id"], ["missing"], ["metadata"]])
def test_invalid_preview_fields_fail_before_writing(
    cli_spec: dict, tmp_path: pathlib.Path, keys: list[str]
) -> None:
    cli_spec["paths"]["/widgets/{id}"]["get"]["x-polar-cli-preview"] = {
        "fields": [{"key": key, "label": key} for key in keys],
    }
    with pytest.raises(ValueError, match="preview field"):
        CLICommandsEmitter(generate_cli_ir(op.OpenAPI.model_validate(cli_spec))).emit(
            tmp_path
        )
    assert not list(tmp_path.iterdir())


def test_unannotated_preview_does_not_guess_fields(
    cli_spec: dict, tmp_path: pathlib.Path
) -> None:
    del cli_spec["paths"]["/widgets/{id}"]["get"]["x-polar-cli-preview"]
    CLICommandsEmitter(generate_cli_ir(op.OpenAPI.model_validate(cli_spec))).emit(
        tmp_path
    )
    source = (tmp_path / "src/widgets/delete.ts").read_text()
    assert "client.widgets.get(config.path.id)" in source
    assert 'key: "id"' not in source


def test_preview_get_cannot_require_extra_input(
    cli_spec: dict, tmp_path: pathlib.Path
) -> None:
    cli_spec["paths"]["/widgets/{id}"]["get"]["parameters"] = [
        {
            "name": "search",
            "in": "query",
            "required": True,
            "schema": {"type": "string"},
        }
    ]
    CLICommandsEmitter(generate_cli_ir(op.OpenAPI.model_validate(cli_spec))).emit(
        tmp_path
    )
    assert "preview:" not in (tmp_path / "src/widgets/delete.ts").read_text()


@pytest.mark.parametrize(
    ("schema", "expected"),
    [
        ({"type": "boolean"}, 'Flag.boolean("value")'),
        (
            {"type": "string", "enum": ["on", "off"]},
            'Flag.choice("value", ["on", "off"])',
        ),
        ({"type": "object", "additionalProperties": True}, 'jsonFlag("value")'),
    ],
)
def test_body_fields_generate_typed_flags(
    cli_spec: dict, tmp_path: pathlib.Path, schema: dict, expected: str
) -> None:
    cli_spec["components"]["schemas"]["WidgetUpdate"]["properties"] = {"value": schema}
    CLICommandsEmitter(generate_cli_ir(op.OpenAPI.model_validate(cli_spec))).emit(
        tmp_path
    )
    source = (tmp_path / "src/widgets/update.ts").read_text()
    assert expected in source
    assert "client.widgets.update(config.path.id, body)" in source


@pytest.mark.parametrize("values", [["off", "on"], ["off", "invalid"]])
def test_confirmation_one_of_checks_enum_values(
    cli_spec: dict, tmp_path: pathlib.Path, values: list[str]
) -> None:
    cli_spec["components"]["schemas"]["WidgetUpdate"]["properties"] = {
        "status": {
            "type": "string",
            "enum": ["on", "off"],
            "x-polar-cli-confirm": {"one_of": values},
        },
    }
    emitter = CLICommandsEmitter(generate_cli_ir(op.OpenAPI.model_validate(cli_spec)))
    if "invalid" in values:
        with pytest.raises(ValueError, match="does not match its schema"):
            emitter.emit(tmp_path)
    else:
        emitter.emit(tmp_path)
        source = (tmp_path / "src/widgets/update.ts").read_text()
        assert (
            'confirmationInput["status"] === "off" || confirmationInput["status"] === "on"'
            in source
        )


def test_untagged_spec_fails_before_writing(tmp_path: pathlib.Path) -> None:
    spec = op.OpenAPI.model_validate(
        {"openapi": "3.1.0", "info": {"title": "Old snapshot", "version": "2026-04"}}
    )
    with pytest.raises(ValueError, match="Regenerate OpenAPI"):
        CLICommandsEmitter(generate_cli_ir(spec)).emit(tmp_path)
    assert not list(tmp_path.iterdir())
