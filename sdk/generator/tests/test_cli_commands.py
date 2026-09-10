import pathlib

import openapi_pydantic as op
import pytest

from cli_commands.emitter import CLICommandsEmitter
from generator.ir import APIIR, generate_ir


@pytest.fixture(scope="module")
def cli_ir() -> APIIR:
    spec_path = pathlib.Path(__file__).parents[1] / "openapi/2026-04.openapi.json"
    return generate_ir(op.OpenAPI.model_validate_json(spec_path.read_text()))


def test_generates_customer_commands(cli_ir: APIIR, tmp_path: pathlib.Path) -> None:
    CLICommandsEmitter(cli_ir).emit(tmp_path)
    commands = tmp_path / "src/customers"
    assert {path.stem for path in commands.glob("*.ts")} == {
        "create",
        "delete",
        "delete_external",
        "get",
        "get_external",
        "get_state",
        "get_state_external",
        "list",
        "list_payment_methods",
        "list_payment_methods_external",
        "update",
        "update_external",
    }
    listing = (commands / "list.ts").read_text()
    assert 'Flag.boolean("active")' in listing
    assert 'Flag.string("organization-id").pipe(Flag.atLeast(1))' in listing
    assert "client.customers.list(query)" in listing
    assert "Parameters<Polar['customers']['list']>[0]" in listing
    create = (commands / "create.ts").read_text()
    assert 'Flag.string("email")' in create
    assert 'Flag.choice("type", ["individual", "team"])' in create
    assert 'jsonFlag("billing-address")' in create
    assert "client.customers.create(body)" in create
    delete = (commands / "delete.ts").read_text()
    assert "client.customers.delete(config.id, query)" in delete
    assert "confirm: config.confirm" in delete
    assert (
        "export const commands = [customers]" in (tmp_path / "src/index.ts").read_text()
    )


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
    emitter.emit(tmp_path)
    regenerated = {
        p.relative_to(tmp_path): p.read_bytes()
        for p in tmp_path.rglob("*")
        if p.is_file()
    }
    assert regenerated == original


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


def test_missing_operation_fails_before_writing(
    cli_ir: APIIR, tmp_path: pathlib.Path
) -> None:
    changed = cli_ir.model_copy(deep=True)
    service = next(s for s in changed.versions[0].services if s.name == "Customers")
    service.methods = [m for m in service.methods if m.name != "get"]
    with pytest.raises(ValueError, match="Missing customer operations"):
        CLICommandsEmitter(changed).emit(tmp_path)
    assert not list(tmp_path.iterdir())
