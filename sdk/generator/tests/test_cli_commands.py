import pathlib

import openapi_pydantic as op
import pytest

from cli_commands.emitter import CLICommandsEmitter
from cli_commands.ir import generate_cli_ir
from generator.ir import (
    APIIR,
    CLIConfirmation,
    CLIPreview,
    CLIPreviewField,
    UnionType,
    generate_ir,
)


@pytest.fixture(scope="module")
def cli_spec() -> op.OpenAPI:
    spec_path = pathlib.Path(__file__).parents[1] / "openapi/2026-04.openapi.json"
    return op.OpenAPI.model_validate_json(spec_path.read_text())


@pytest.fixture(scope="module")
def cli_ir(cli_spec: op.OpenAPI) -> APIIR:
    return generate_cli_ir(cli_spec)


def test_generates_every_cli_tagged_operation(
    cli_spec: op.OpenAPI, cli_ir: APIIR, tmp_path: pathlib.Path
) -> None:
    CLICommandsEmitter(cli_ir).emit(tmp_path)
    expected = {
        operation["operationId"]
        for path in cli_spec.model_dump(mode="json")["paths"].values()
        for operation in path.values()
        if isinstance(operation, dict)
        and "cli" in (operation.get("tags") or [])
        and "private" not in (operation.get("tags") or [])
    }
    generated = {
        path.read_text().splitlines()[0].split()[3]
        for path in (tmp_path / "src").rglob("*.ts")
        if path.name != "index.ts" and path.read_text().startswith("// Generated from ")
    }
    assert generated == expected
    for path in (tmp_path / "src").rglob("*.ts"):
        source = path.read_text()
        assert "config.production" not in source
        assert "export const production" not in source
        if source.startswith("// Generated from "):
            assert "environment:" not in source

    assert "products:list" in generated
    assert "customers:members:create_external" in generated
    assert "organizations:update" not in generated
    assert "checkout_links:redirect" not in generated

    listing = (tmp_path / "src/customers/list.ts").read_text()
    assert 'Flag.boolean("active")' in listing
    assert 'Flag.string("organization-id").pipe(Flag.atLeast(1))' in listing
    assert "client.customers.list(query)" in listing
    for name in ("create", "update"):
        benefit = (tmp_path / f"src/benefits/{name}.ts").read_text()
        assert 'Flag.choice("type",' in benefit
        assert 'jsonFlag("type")' not in benefit
    create = (tmp_path / "src/customers/create.ts").read_text()
    assert 'Flag.string("email")' in create
    assert 'Flag.choice("type", ["individual", "team"])' in create
    assert 'jsonFlag("billing-address")' in create
    delete = (tmp_path / "src/customers/delete.ts").read_text()
    assert "client.customers.delete(config.path.id, query)" in delete
    assert "confirm: config.confirm" in delete
    member = (tmp_path / "src/customers/members/create_external.ts").read_text()
    assert (
        "client.customers.members.createExternal(config.path.external_id, body)"
        in member
    )
    assert "external_id: config.input.external_id" in member
    assert "from '../../runtime'" in member
    assert "from './members'" in (tmp_path / "src/customers/index.ts").read_text()


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
    cli_ir: APIIR, tmp_path: pathlib.Path
) -> None:
    emitter = CLICommandsEmitter(cli_ir)
    emitter.emit(tmp_path)
    original = {
        p.relative_to(tmp_path): p.read_bytes()
        for p in tmp_path.rglob("*")
        if p.is_file()
    }
    (tmp_path / "src/customers/stale.ts").write_text("stale")
    (tmp_path / "src/stale_resource").mkdir()
    (tmp_path / "src/stale_resource/index.ts").write_text("stale")
    emitter.emit(tmp_path)
    regenerated = {
        p.relative_to(tmp_path): p.read_bytes()
        for p in tmp_path.rglob("*")
        if p.is_file()
    }
    assert regenerated == original


def test_removing_tags_removes_commands_and_empty_resources(
    cli_spec: op.OpenAPI, tmp_path: pathlib.Path
) -> None:
    changed = cli_spec.model_copy(deep=True)
    CLICommandsEmitter(generate_cli_ir(changed)).emit(tmp_path)
    assert changed.paths is not None
    for path in changed.paths.values():
        for operation in (path.get, path.post, path.patch, path.delete):
            if operation and (operation.operationId or "").startswith("products:"):
                operation.tags = [tag for tag in (operation.tags or []) if tag != "cli"]
    CLICommandsEmitter(generate_cli_ir(changed)).emit(tmp_path)
    assert not (tmp_path / "src/products").exists()
    assert "from './products'" not in (tmp_path / "src/index.ts").read_text()
    assert (tmp_path / "src/customers/list.ts").exists()


def test_generation_tracks_ir_changes(cli_ir: APIIR, tmp_path: pathlib.Path) -> None:
    changed = cli_ir.model_copy(deep=True)
    service = next(s for s in changed.versions[0].services if s.name == "Customers")
    method = next(m for m in service.methods if m.name == "list")
    method.description = "Updated customer listing documentation."
    method.query_params = [p for p in method.query_params if p.name != "email"]
    CLICommandsEmitter(changed).emit(tmp_path)
    listing = (tmp_path / "src/customers/list.ts").read_text()
    assert "Updated customer listing documentation." in listing
    assert 'Flag.string("email")' not in listing


def test_product_archive_confirmation_uses_merged_input(
    cli_ir: APIIR, tmp_path: pathlib.Path
) -> None:
    CLICommandsEmitter(cli_ir).emit(tmp_path)
    source = (tmp_path / "src/products/update.ts").read_text()
    assert "Schema.optionalKey(Schema.NullOr(Schema.Boolean))" in source
    assert 'requiresConfirmation: confirmationInput["is_archived"] === true' in source
    assert "confirm: config.confirm" in source
    assert "client.products.get(config.path.id)" in source
    assert source.index("mergeInput<Body>") < source.index("Schema.decodeUnknownEffect")
    assert (
        "requiresConfirmation: true"
        in (tmp_path / "src/customers/delete.ts").read_text()
    )
    assert "confirm: false" in (tmp_path / "src/products/create.ts").read_text()


@pytest.mark.parametrize("value", ["true", 1])
def test_confirmation_value_must_match_field_schema(
    cli_ir: APIIR, tmp_path: pathlib.Path, value: str | int
) -> None:
    changed = cli_ir.model_copy(deep=True)
    model = next(
        model
        for model in changed.versions[0].input_models
        if model.name == "ProductUpdate"
    )
    field = next(field for field in model.fields if field.name == "is_archived")
    field.cli_confirm = CLIConfirmation(equals=value)
    with pytest.raises(ValueError, match="does not match its schema"):
        CLICommandsEmitter(changed).emit(tmp_path)


def test_confirmation_metadata_on_query_fields(
    cli_spec: op.OpenAPI, tmp_path: pathlib.Path
) -> None:
    changed = cli_spec.model_copy(deep=True)
    assert changed.paths is not None
    operation = changed.paths["/v1/products/"].get
    assert operation is not None
    parameter = next(
        parameter
        for parameter in operation.parameters or []
        if isinstance(parameter, op.Parameter) and parameter.name == "is_archived"
    )
    assert isinstance(parameter.param_schema, op.Schema)
    parameter.param_schema.__pydantic_extra__ = {
        "x-polar-cli-confirm": {"equals": True}
    }
    CLICommandsEmitter(generate_cli_ir(changed)).emit(tmp_path)
    source = (tmp_path / "src/products/list.ts").read_text()
    assert ")(query).pipe(" in source
    assert 'confirmationInput["is_archived"] === true' in source
    assert "confirm: config.confirm" in source
    assert "preview:" not in source


@pytest.mark.parametrize("annotation", [{}, {"equals": []}, {"equals": {}}])
def test_malformed_confirmation_annotations_fail(
    cli_spec: op.OpenAPI, annotation: dict[str, object]
) -> None:
    changed = cli_spec.model_copy(deep=True)
    assert changed.components is not None and changed.components.schemas is not None
    schema = changed.components.schemas["ProductUpdate"]
    assert isinstance(schema, op.Schema) and schema.properties is not None
    field = schema.properties["is_archived"]
    assert isinstance(field, op.Schema)
    field.__pydantic_extra__ = {"x-polar-cli-confirm": annotation}
    with pytest.raises(ValueError, match="equals"):
        generate_cli_ir(changed)


def test_confirmation_metadata_is_preserved_across_body_variants(
    cli_ir: APIIR, tmp_path: pathlib.Path
) -> None:
    changed = cli_ir.model_copy(deep=True)
    model = next(
        model
        for model in changed.versions[0].input_models
        if model.name == "BenefitCustomUpdate"
    )
    field = next(field for field in model.fields if field.name == "description")
    field.cli_confirm = CLIConfirmation(equals="archive")
    CLICommandsEmitter(changed).emit(tmp_path)
    source = (tmp_path / "src/benefits/update.ts").read_text()
    assert 'confirmationInput["description"] === "archive"' in source
    assert "confirm: config.confirm" in source

    service = next(
        service
        for service in changed.versions[0].services
        if service.name == "Benefits"
    )
    method = next(method for method in service.methods if method.name == "update")
    assert isinstance(method.body, UnionType)
    method.body.variants.reverse()
    CLICommandsEmitter(changed).emit(tmp_path)
    assert (
        'confirmationInput["description"] === "archive"'
        in (tmp_path / "src/benefits/update.ts").read_text()
    )


def test_delete_previews_match_get_paths(cli_ir: APIIR, tmp_path: pathlib.Path) -> None:
    CLICommandsEmitter(cli_ir).emit(tmp_path)
    expected = {
        "customers/delete": "client.customers.get(config.path.id)",
        "customers/delete_external": "client.customers.getExternal(config.path.external_id)",
        "customers/members/delete": "client.customers.members.get(config.path.id, config.path.member_id)",
        "subscriptions/revoke": "client.subscriptions.get(config.path.id)",
        "webhooks/delete_webhook_endpoint": "client.webhooks.getWebhookEndpoint(config.path.id)",
    }
    for command, invocation in expected.items():
        source = (tmp_path / f"src/{command}.ts").read_text()
        assert f"invoke: (client) => {invocation}," in source
        assert 'key: "id", label: "ID"' in source
    for command in ("files/delete", "customer_seats/revoke_seat", "customers/update"):
        assert "preview:" not in (tmp_path / f"src/{command}.ts").read_text()


@pytest.mark.parametrize("tags", [["public", "mcp"], ["private", "cli"]])
def test_preview_get_must_be_cli_eligible(
    cli_spec: op.OpenAPI, tmp_path: pathlib.Path, tags: list[str]
) -> None:
    changed = cli_spec.model_copy(deep=True)
    assert changed.paths is not None
    get = changed.paths["/v1/customers/{id}"].get
    assert get is not None
    get.tags = tags
    CLICommandsEmitter(generate_cli_ir(changed)).emit(tmp_path)
    assert "preview:" not in (tmp_path / "src/customers/delete.ts").read_text()


def test_preview_metadata_preserves_field_order(
    cli_ir: APIIR, tmp_path: pathlib.Path
) -> None:
    changed = cli_ir.model_copy(deep=True)
    service = next(s for s in changed.versions[0].services if s.name == "Customers")
    get = next(m for m in service.methods if m.name == "get")
    assert get.cli_preview is not None
    assert [(f.key, f.label) for f in get.cli_preview.fields] == [
        ("id", "ID"),
        ("name", "Name"),
        ("email", "Email"),
        ("external_id", "External ID"),
    ]
    get.cli_preview.fields.reverse()
    CLICommandsEmitter(changed).emit(tmp_path)
    source = (tmp_path / "src/customers/delete.ts").read_text()
    assert source.index('key: "external_id"') < source.index('key: "id"')


@pytest.mark.parametrize("keys", [[], ["id", "id"], ["missing"], ["metadata"]])
def test_invalid_preview_fields_fail_before_writing(
    cli_ir: APIIR, tmp_path: pathlib.Path, keys: list[str]
) -> None:
    changed = cli_ir.model_copy(deep=True)
    service = next(s for s in changed.versions[0].services if s.name == "Customers")
    get = next(m for m in service.methods if m.name == "get")
    get.cli_preview = CLIPreview(
        fields=[CLIPreviewField(key=key, label=key) for key in keys]
    )
    with pytest.raises(ValueError, match="preview field"):
        CLICommandsEmitter(changed).emit(tmp_path)
    assert not list(tmp_path.iterdir())


def test_preview_field_must_be_readable_in_every_variant(
    cli_ir: APIIR, tmp_path: pathlib.Path
) -> None:
    changed = cli_ir.model_copy(deep=True)
    model = next(
        m for m in changed.versions[0].output_models if m.name == "CustomerTeam"
    )
    field = next(f for f in model.fields if f.name == "email")
    field.write_only = True
    with pytest.raises(ValueError, match="readable scalar"):
        CLICommandsEmitter(changed).emit(tmp_path)
    model.fields.remove(field)
    with pytest.raises(ValueError, match="every response variant"):
        CLICommandsEmitter(changed).emit(tmp_path)
    assert not list(tmp_path.iterdir())


def test_unannotated_preview_does_not_guess_fields(
    cli_ir: APIIR, tmp_path: pathlib.Path
) -> None:
    changed = cli_ir.model_copy(deep=True)
    service = next(s for s in changed.versions[0].services if s.name == "Customers")
    get = next(m for m in service.methods if m.name == "get")
    get.cli_preview = None
    CLICommandsEmitter(changed).emit(tmp_path)
    source = (tmp_path / "src/customers/delete.ts").read_text()
    assert "client.customers.get(config.path.id)" in source
    assert 'key: "id"' not in source


def test_preview_get_cannot_require_extra_input(
    cli_ir: APIIR, tmp_path: pathlib.Path
) -> None:
    changed = cli_ir.model_copy(deep=True)
    service = next(s for s in changed.versions[0].services if s.name == "Customers")
    get = next(m for m in service.methods if m.name == "get")
    listing = next(m for m in service.methods if m.name == "list")
    get.query_params = [listing.query_params[0].model_copy(update={"required": True})]
    CLICommandsEmitter(changed).emit(tmp_path)
    assert "preview:" not in (tmp_path / "src/customers/delete.ts").read_text()


def test_untagged_spec_fails_before_writing(tmp_path: pathlib.Path) -> None:
    spec = op.OpenAPI.model_validate(
        {"openapi": "3.1.0", "info": {"title": "Old snapshot", "version": "2026-04"}}
    )
    with pytest.raises(ValueError, match="Regenerate OpenAPI"):
        CLICommandsEmitter(generate_cli_ir(spec)).emit(tmp_path)
    assert not list(tmp_path.iterdir())
