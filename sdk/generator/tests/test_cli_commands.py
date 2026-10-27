import copy
import pathlib
import re
import typing

import openapi_pydantic as op
import pytest

from cli_commands.emitter import CLICommandsEmitter
from cli_commands.ir import is_private_cli_operation
from generator.ir import DestructiveCondition, generate_ir


@pytest.fixture
def cli_spec() -> dict:
    spec: dict = {
        "openapi": "3.1.0",
        "info": {"title": "Widgets", "version": "2026-10"},
        "security": [{"bearerAuth": []}],
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
                    "x-tool-annotations": ["read_only", "idempotent"],
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
                    "x-tool-annotations": ["destructive"],
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
                    "x-tool-annotations": ["destructive", "idempotent"],
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
                            "x-tool-destructive-when": {"equals": True},
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
            "info": {"title": "Tag selection", "version": "2026-10"},
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
    CLICommandsEmitter(
        generate_ir(spec, is_private_operation=is_private_cli_operation), "0.0.0"
    ).emit(tmp_path)
    assert (tmp_path / "src/widgets/list.ts").exists()
    assert (tmp_path / "src/widgets/create.ts").exists() == included
    sdk_methods = {m.name for m in generate_ir(spec).versions[0].services[0].methods}
    assert ("create" in sdk_methods) == ("private" not in (tags or []))


def test_regeneration_is_deterministic_and_removes_stale_commands(
    cli_spec: dict, tmp_path: pathlib.Path
) -> None:
    emitter = CLICommandsEmitter(
        generate_ir(
            op.OpenAPI.model_validate(cli_spec),
            is_private_operation=is_private_cli_operation,
        ),
        "0.0.0",
    )
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
    CLICommandsEmitter(
        generate_ir(
            op.OpenAPI.model_validate(cli_spec),
            is_private_operation=is_private_cli_operation,
        ),
        "0.0.0",
    ).emit(tmp_path)
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


@pytest.mark.parametrize(
    ("annotations", "properties", "expected"),
    [
        (["destructive"], {}, "requiresConfirmation: true"),
        (
            ["destructive"],
            {"is_archived": {"type": "boolean"}},
            "requiresConfirmation: true",
        ),
        (None, {"is_archived": {"type": "boolean"}}, "confirm: false"),
        ([], {"is_archived": {"type": "boolean"}}, "confirm: false"),
    ],
)
def test_confirmation_follows_destructive_annotation(
    cli_spec: dict,
    tmp_path: pathlib.Path,
    annotations: list[str] | None,
    properties: dict,
    expected: str,
) -> None:
    operation = cli_spec["paths"]["/widgets/{id}"]["patch"]
    if annotations is None:
        del operation["x-tool-annotations"]
    else:
        operation["x-tool-annotations"] = annotations
    cli_spec["components"]["schemas"]["WidgetUpdate"]["properties"] = properties
    CLICommandsEmitter(
        generate_ir(
            op.OpenAPI.model_validate(cli_spec),
            is_private_operation=is_private_cli_operation,
        ),
        "0.0.0",
    ).emit(tmp_path)
    assert expected in (tmp_path / "src/widgets/update.ts").read_text()


def test_destructive_fields_require_destructive_operation(
    cli_spec: dict, tmp_path: pathlib.Path
) -> None:
    del cli_spec["paths"]["/widgets/{id}"]["patch"]["x-tool-annotations"]
    with pytest.raises(ValueError, match="isn't destructive"):
        CLICommandsEmitter(
            generate_ir(
                op.OpenAPI.model_validate(cli_spec),
                is_private_operation=is_private_cli_operation,
            ),
            "0.0.0",
        ).emit(tmp_path)


@pytest.mark.parametrize("value", ["true", 1])
def test_confirmation_value_must_match_field_schema(
    cli_spec: dict, tmp_path: pathlib.Path, value: str | int
) -> None:
    cli_spec["components"]["schemas"]["WidgetUpdate"]["properties"]["is_archived"][
        "x-tool-destructive-when"
    ] = {"equals": value}
    with pytest.raises(ValueError, match="does not match its schema"):
        CLICommandsEmitter(
            generate_ir(
                op.OpenAPI.model_validate(cli_spec),
                is_private_operation=is_private_cli_operation,
            ),
            "0.0.0",
        ).emit(tmp_path)


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
        "x-tool-destructive-when"
    ] = annotation
    with pytest.raises(ValueError, match="equals"):
        generate_ir(
            op.OpenAPI.model_validate(cli_spec),
            is_private_operation=is_private_cli_operation,
        )


def test_confirmation_rules_round_trip() -> None:
    for rule in [
        DestructiveCondition(equals=None),
        DestructiveCondition(equals=False),
        DestructiveCondition(one_of=["revoked", "disabled"]),
    ]:
        restored = DestructiveCondition.model_validate_json(rule.model_dump_json())
        assert restored.values == rule.values


def test_delete_preview_uses_matching_get_and_field_order(
    cli_spec: dict, tmp_path: pathlib.Path
) -> None:
    CLICommandsEmitter(
        generate_ir(
            op.OpenAPI.model_validate(cli_spec),
            is_private_operation=is_private_cli_operation,
        ),
        "0.0.0",
    ).emit(tmp_path)
    source = (tmp_path / "src/widgets/delete.ts").read_text()
    assert "invoke: (client) => client.widgets.get(config.path.id)," in source
    assert 'key: "id", label: "ID"' in source
    assert source.index('key: "id"') < source.index('key: "name"')


@pytest.mark.parametrize("tags", [["public", "mcp"], ["private", "cli"]])
def test_preview_get_must_be_cli_eligible(
    cli_spec: dict, tmp_path: pathlib.Path, tags: list[str]
) -> None:
    cli_spec["paths"]["/widgets/{id}"]["get"]["tags"] = tags
    CLICommandsEmitter(
        generate_ir(
            op.OpenAPI.model_validate(cli_spec),
            is_private_operation=is_private_cli_operation,
        ),
        "0.0.0",
    ).emit(tmp_path)
    assert "preview:" not in (tmp_path / "src/widgets/delete.ts").read_text()


@pytest.mark.parametrize("keys", [[], ["id", "id"], ["missing"], ["metadata"]])
def test_invalid_preview_fields_fail_before_writing(
    cli_spec: dict, tmp_path: pathlib.Path, keys: list[str]
) -> None:
    cli_spec["paths"]["/widgets/{id}"]["get"]["x-polar-cli-preview"] = {
        "fields": [{"key": key, "label": key} for key in keys],
    }
    with pytest.raises(ValueError, match="preview field"):
        CLICommandsEmitter(
            generate_ir(
                op.OpenAPI.model_validate(cli_spec),
                is_private_operation=is_private_cli_operation,
            ),
            "0.0.0",
        ).emit(tmp_path)
    assert not list(tmp_path.iterdir())


def test_unannotated_preview_does_not_guess_fields(
    cli_spec: dict, tmp_path: pathlib.Path
) -> None:
    del cli_spec["paths"]["/widgets/{id}"]["get"]["x-polar-cli-preview"]
    CLICommandsEmitter(
        generate_ir(
            op.OpenAPI.model_validate(cli_spec),
            is_private_operation=is_private_cli_operation,
        ),
        "0.0.0",
    ).emit(tmp_path)
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
    CLICommandsEmitter(
        generate_ir(
            op.OpenAPI.model_validate(cli_spec),
            is_private_operation=is_private_cli_operation,
        ),
        "0.0.0",
    ).emit(tmp_path)
    assert "preview:" not in (tmp_path / "src/widgets/delete.ts").read_text()


@pytest.mark.parametrize(
    ("schema", "expected"),
    [
        ({"type": "boolean"}, 'Flag.Boolean("value")'),
        (
            {"type": "string", "enum": ["on", "off"]},
            'Flag.Literals("value", ["on", "off"])',
        ),
        ({"type": "object", "additionalProperties": True}, 'jsonFlag("value")'),
    ],
)
def test_body_fields_generate_typed_flags(
    cli_spec: dict, tmp_path: pathlib.Path, schema: dict, expected: str
) -> None:
    cli_spec["components"]["schemas"]["WidgetUpdate"]["properties"] = {"value": schema}
    CLICommandsEmitter(
        generate_ir(
            op.OpenAPI.model_validate(cli_spec),
            is_private_operation=is_private_cli_operation,
        ),
        "0.0.0",
    ).emit(tmp_path)
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
            "x-tool-destructive-when": {"one_of": values},
        },
    }
    emitter = CLICommandsEmitter(
        generate_ir(
            op.OpenAPI.model_validate(cli_spec),
            is_private_operation=is_private_cli_operation,
        ),
        "0.0.0",
    )
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


@pytest.mark.parametrize("method", ["get", "patch"])
def test_organization_inputs_are_passed_through_for_resolution(
    cli_spec: dict, tmp_path: pathlib.Path, method: str
) -> None:
    if method == "get":
        cli_spec["paths"]["/widgets/{id}"][method]["parameters"] = [
            *cli_spec["paths"]["/widgets/{id}"][method]["parameters"],
            {
                "name": "organization_id",
                "in": "query",
                "schema": {"type": "string"},
            },
        ]
    else:
        cli_spec["components"]["schemas"]["WidgetUpdate"]["properties"][
            "organization_id"
        ] = {"type": "string"}
    CLICommandsEmitter(
        generate_ir(
            op.OpenAPI.model_validate(cli_spec),
            is_private_operation=is_private_cli_operation,
        ),
        "0.0.0",
    ).emit(tmp_path)
    command, input_name = ("get", "query") if method == "get" else ("update", "body")
    source = (tmp_path / f"src/widgets/{command}.ts").read_text()
    assert (
        'organization_id: Flag.String("organization-id").pipe(\n'
        "      Flag.withAlias('org'),"
    ) in source
    if method == "get":
        assert "organizationId: query.organization_id," in source
    else:
        assert "const { organization_id: organizationId, ...body } = mergeInput" in (
            source
        )
        assert "      organizationId,\n" in source
    assert (
        f"invoke: (client) => client.widgets.{command}(config.path.id, {input_name}),"
        in source
    )


def test_untagged_spec_fails_before_writing(tmp_path: pathlib.Path) -> None:
    spec = op.OpenAPI.model_validate(
        {"openapi": "3.1.0", "info": {"title": "Old snapshot", "version": "2026-10"}}
    )
    with pytest.raises(ValueError, match="Regenerate OpenAPI"):
        CLICommandsEmitter(
            generate_ir(spec, is_private_operation=is_private_cli_operation), "0.0.0"
        ).emit(tmp_path)
    assert not list(tmp_path.iterdir())


def _emit(spec: dict, tmp_path: pathlib.Path) -> None:
    CLICommandsEmitter(
        generate_ir(
            op.OpenAPI.model_validate(spec),
            is_private_operation=is_private_cli_operation,
        ),
        "0.0.0",
    ).emit(tmp_path)


def _flag(source: str, name: str) -> str:
    start = source.index(f"    {name}: ")
    return source[start : source.index("    ),\n", start)]


@pytest.fixture
def create_spec(cli_spec: dict) -> dict:
    prices = {
        "type": "array",
        "description": "The prices.",
        "items": {
            "oneOf": [
                {"$ref": "#/components/schemas/FixedPrice"},
                {"$ref": "#/components/schemas/FreePrice"},
            ]
        },
    }
    cli_spec["paths"]["/widgets/"] = {
        "post": {
            "operationId": "widgets:create",
            "tags": ["cli"],
            "requestBody": {
                "required": True,
                "content": {
                    "application/json": {
                        "schema": {"$ref": "#/components/schemas/WidgetCreate"},
                    },
                },
            },
            "responses": {"204": {"description": "Created"}},
        },
    }
    cli_spec["components"]["schemas"] |= {
        "WidgetCreate": {
            "oneOf": [
                {"$ref": "#/components/schemas/WidgetCreateRecurring"},
                {"$ref": "#/components/schemas/WidgetCreateOneTime"},
            ]
        },
        "WidgetCreateRecurring": {
            "type": "object",
            "required": ["name", "prices", "interval"],
            "properties": {
                "name": {"type": "string", "description": "The **name**."},
                "prices": prices,
                "interval": {
                    "type": "string",
                    "enum": ["month", "year"],
                    "description": "The billing interval.",
                },
                "email": {"type": "string", "format": "email"},
                "organization_id": {
                    "type": "string",
                    "description": "The owner. **Required unless you use an organization token.**",
                },
            },
        },
        "WidgetCreateOneTime": {
            "type": "object",
            "required": ["name", "prices"],
            "properties": {
                "name": {"type": "string", "description": "The **name**."},
                "prices": prices,
                "interval": {
                    "type": "null",
                    "description": "One-time widgets have no interval.",
                },
                "email": {
                    "anyOf": [{"type": "string", "format": "email"}, {"type": "null"}]
                },
                "organization_id": {
                    "type": "string",
                    "description": "The owner. **Required unless you use an organization token.**",
                },
            },
        },
        "FixedPrice": {
            "type": "object",
            "required": ["amount_type", "amount"],
            "properties": {
                "amount_type": {"type": "string", "const": "fixed"},
                "amount": {"type": "integer"},
                "currency": {"type": "string"},
            },
        },
        "FreePrice": {
            "type": "object",
            "properties": {
                "amount_type": {"type": "string", "const": "free", "default": "free"},
            },
        },
    }
    return cli_spec


def test_flags_required_by_every_variant_are_marked(
    create_spec: dict, tmp_path: pathlib.Path
) -> None:
    _emit(create_spec, tmp_path)
    source = (tmp_path / "src/widgets/create.ts").read_text()
    assert 'Flag.withDescription("Required. The name.")' in _flag(source, "name")
    assert "Required." not in _flag(source, "interval")


def test_flag_description_comes_from_the_variant_that_uses_the_field(
    create_spec: dict, tmp_path: pathlib.Path
) -> None:
    _emit(create_spec, tmp_path)
    source = (tmp_path / "src/widgets/create.ts").read_text()
    assert "The billing interval." in _flag(source, "interval")
    assert "One-time widgets" not in source


def test_json_flags_describe_their_shape(
    create_spec: dict, tmp_path: pathlib.Path
) -> None:
    _emit(create_spec, tmp_path)
    source = (tmp_path / "src/widgets/create.ts").read_text()
    assert (
        'JSON: array of ({\\"amount_type\\": \\"fixed\\", \\"amount\\": integer, ...}'
        ' | {\\"amount_type\\": \\"free\\"})'
    ) in _flag(source, "prices")


def test_flag_descriptions_never_contain_square_brackets(
    create_spec: dict, tmp_path: pathlib.Path
) -> None:
    variant = create_spec["components"]["schemas"]["WidgetCreateRecurring"]
    variant["properties"]["name"]["description"] = (
        "The name. It uses the `deepObject` style, e.g. `?name[key]=value`."
    )
    _emit(create_spec, tmp_path)
    source = (tmp_path / "src/widgets/create.ts").read_text()
    descriptions = re.findall(r"Flag\.withDescription\((.*)\)", source)
    assert 'Flag.withDescription("Required. The name.")' in _flag(source, "name")
    assert descriptions
    assert not any("[" in d or "]" in d for d in descriptions)


def test_organization_flag_defaults_to_the_active_organization(
    create_spec: dict, tmp_path: pathlib.Path
) -> None:
    _emit(create_spec, tmp_path)
    source = (tmp_path / "src/widgets/create.ts").read_text()
    assert (
        'Flag.withDescription("The owner. Defaults to the active organization.")'
        in _flag(source, "organization_id")
    )


def test_optional_and_required_strings_merge_into_a_string_flag(
    create_spec: dict, tmp_path: pathlib.Path
) -> None:
    _emit(create_spec, tmp_path)
    source = (tmp_path / "src/widgets/create.ts").read_text()
    assert 'email: nullableStringFlag("email")' in source


def test_missing_required_flags_fail_locally_with_an_example(
    create_spec: dict, tmp_path: pathlib.Path
) -> None:
    create_spec["components"]["schemas"]["FixedPrice"]["properties"]["currency"] = {
        "type": "string",
        "examples": ["usd"],
    }
    create_spec["components"]["schemas"]["FixedPrice"]["required"].append("currency")
    _emit(create_spec, tmp_path)
    source = (tmp_path / "src/widgets/create.ts").read_text()
    assert 'const missing = missingFlags(body, ["name", "prices"])' in source
    assert (
        "hint: \"Example: polar widgets create --name <name> --prices '"
        '[{\\"amount_type\\":\\"fixed\\",\\"amount\\":<amount>,\\"currency\\":\\"usd\\"}]\'"'
    ) in source


def test_commands_without_required_input_skip_the_check(
    cli_spec: dict, tmp_path: pathlib.Path
) -> None:
    _emit(cli_spec, tmp_path)
    assert "missingFlags" not in (tmp_path / "src/widgets/update.ts").read_text()


def test_flag_descriptions_that_differ_between_variants_are_combined(
    create_spec: dict, tmp_path: pathlib.Path
) -> None:
    schemas = create_spec["components"]["schemas"]
    schemas["WidgetCreateRecurring"]["properties"]["email"]["description"] = (
        "The email. Must be unique."
    )
    schemas["WidgetCreateOneTime"]["properties"]["email"]["description"] = (
        "Optional when an owner is given."
    )
    _emit(create_spec, tmp_path)
    source = (tmp_path / "src/widgets/create.ts").read_text()
    assert "The email. Must be unique. Optional when an owner is given." in _flag(
        source, "email"
    )


def test_json_shapes_mark_nullable_fields(
    create_spec: dict, tmp_path: pathlib.Path
) -> None:
    price = create_spec["components"]["schemas"]["FixedPrice"]
    price["properties"]["note"] = {"anyOf": [{"type": "string"}, {"type": "null"}]}
    price["required"].append("note")
    _emit(create_spec, tmp_path)
    source = (tmp_path / "src/widgets/create.ts").read_text()
    assert '\\"note\\": string | null,' in _flag(source, "prices")


def test_examples_are_quoted_for_the_shell(
    create_spec: dict, tmp_path: pathlib.Path
) -> None:
    price = create_spec["components"]["schemas"]["FixedPrice"]
    price["properties"]["label"] = {"type": "string", "examples": ["it's fixed"]}
    price["required"].append("label")
    _emit(create_spec, tmp_path)
    source = (tmp_path / "src/widgets/create.ts").read_text()
    assert "it'\\\"'\\\"'s fixed" in source


def test_only_absent_required_fields_count_as_missing(
    create_spec: dict, tmp_path: pathlib.Path
) -> None:
    _emit(create_spec, tmp_path)
    assert "[key] === undefined" in (tmp_path / "src/inputs.ts").read_text()


def test_json_commands_take_fields(cli_spec: dict, tmp_path: pathlib.Path) -> None:
    _emit(cli_spec, tmp_path)
    assert "fields: config.fields," in (tmp_path / "src/widgets/get.ts").read_text()
    assert "config.fields" not in (tmp_path / "src/widgets/delete.ts").read_text()


def test_commands_that_can_answer_pending_do_not_take_fields(
    cli_spec: dict, tmp_path: pathlib.Path
) -> None:
    cli_spec["paths"]["/widgets/{id}"]["get"]["responses"]["202"] = {
        "description": "Widget is being prepared."
    }
    _emit(cli_spec, tmp_path)
    get = (tmp_path / "src/widgets/get.ts").read_text()
    assert "pendingResponse:" in get
    assert "config.fields" not in get


def test_inputs_cannot_shadow_the_fields_flag(
    cli_spec: dict, tmp_path: pathlib.Path
) -> None:
    cli_spec["paths"]["/widgets/{id}"]["get"]["parameters"] = [
        {"name": "fields", "in": "query", "schema": {"type": "string"}}
    ]
    with pytest.raises(ValueError, match="collides with the CLI's own --fields"):
        _emit(cli_spec, tmp_path)


def test_inputs_named_fields_are_fine_without_the_fields_flag(
    cli_spec: dict, tmp_path: pathlib.Path
) -> None:
    cli_spec["components"]["schemas"]["WidgetUpdate"]["properties"]["fields"] = {
        "type": "string"
    }
    _emit(cli_spec, tmp_path)
    update = (tmp_path / "src/widgets/update.ts").read_text()
    assert "fields: config.input.fields," in update
    assert "fields: config.fields," not in update


def _next_spec(cli_spec: dict) -> dict:
    spec = copy.deepcopy(cli_spec)
    spec["info"]["version"] = "2027-01"
    get = copy.deepcopy(spec["paths"]["/widgets/{id}"]["get"])
    get["operationId"] = "widgets:get_external"
    get["parameters"] = [{**get["parameters"][0], "name": "external_id"}]
    spec["paths"]["/widgets/external/{external_id}"] = {"get": get}
    return spec


def _emit_versions(specs: list[dict], tmp_path: pathlib.Path) -> None:
    CLICommandsEmitter(
        generate_ir(
            *(op.OpenAPI.model_validate(spec) for spec in specs),
            is_private_operation=is_private_cli_operation,
        ),
        "0.0.0",
    ).emit(tmp_path)


def test_next_only_operations_join_the_current_commands(
    cli_spec: dict, tmp_path: pathlib.Path
) -> None:
    _emit_versions([_next_spec(cli_spec), cli_spec], tmp_path)

    current = (tmp_path / "src/widgets/get.ts").read_text()
    assert "apiVersion" not in current
    assert "preview, API" not in current

    upcoming = (tmp_path / "src/widgets/get_external.ts").read_text()
    assert 'apiVersion: "2027-01",' in upcoming
    assert "(preview, API 2027-01)" in upcoming

    service = (tmp_path / "src/widgets/index.ts").read_text()
    assert "./get_external'" in service

    runtime = (tmp_path / "src/runtime.ts").read_text()
    assert "from '@polar-sh/sdk/2027-01'" in runtime
    assert 'export const CURRENT_API_VERSION = "2026-10"' in runtime


def test_operations_in_both_versions_stay_on_current(
    cli_spec: dict, tmp_path: pathlib.Path
) -> None:
    upcoming = _next_spec(cli_spec)
    upcoming["paths"]["/widgets/{id}"]["get"]["description"] = "Changed in Next."
    _emit_versions([cli_spec, upcoming], tmp_path)

    current = (tmp_path / "src/widgets/get.ts").read_text()
    assert "apiVersion" not in current
    assert "Changed in Next." not in current


def test_renamed_path_parameter_in_next_stays_on_current(
    cli_spec: dict, tmp_path: pathlib.Path
) -> None:
    upcoming = _next_spec(cli_spec)
    get = upcoming["paths"].pop("/widgets/{id}")["get"]
    get["parameters"] = [{**get["parameters"][0], "name": "widget_id"}]
    upcoming["paths"]["/widgets/{widget_id}"] = {"get": get}
    _emit_versions([cli_spec, upcoming], tmp_path)

    current = (tmp_path / "src/widgets/get.ts").read_text()
    assert "apiVersion" not in current


def test_next_only_operation_cannot_reuse_a_current_command_name(
    cli_spec: dict, tmp_path: pathlib.Path
) -> None:
    upcoming = _next_spec(cli_spec)
    upcoming["paths"]["/widgets/{id}"]["get"]["operationId"] = "widgets:fetch"
    upcoming["paths"]["/widgets/external/{external_id}"]["get"]["operationId"] = (
        "widgets:get"
    )
    with pytest.raises(ValueError, match="Next adds get to Widgets"):
        _emit_versions([cli_spec, upcoming], tmp_path)
