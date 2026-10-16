import json
import pathlib

import openapi_pydantic as op

from generator.ir import generate_ir
from typescript.emitter import TypeScriptEmitter


def test_emits_ingestion_and_outpost_submodules(
    code_samples_spec: op.OpenAPI, tmp_path: pathlib.Path
) -> None:
    TypeScriptEmitter(generate_ir(code_samples_spec), "1.2.3").emit(tmp_path)

    manifest = json.loads((tmp_path / "package.json").read_text())
    assert (
        manifest["exports"]["./outpost"]["import"]["default"]
        == "./dist/outpost/index.mjs"
    )
    assert manifest["peerDependenciesMeta"]["ws"]["optional"] is True
    for module in ("client", "event", "reducer", "scripts", "index"):
        assert (tmp_path / "src" / "outpost" / f"{module}.ts").is_file()
    tests = (tmp_path / "src" / "outpost" / "client.test.ts").read_text()
    assert 'from "../2026-04/client"' in tests
    assert '"src/outpost/index.ts"' in (tmp_path / "tsdown.config.ts").read_text()
    assert (
        manifest["exports"]["./ingestion"]["import"]["default"]
        == "./dist/ingestion/index.mjs"
    )
    assert (
        manifest["exports"]["./ingestion"]["require"]["default"]
        == "./dist/ingestion/index.cjs"
    )
    for module in (
        "client",
        "buffered",
        "event",
        "index",
        "client.test",
        "buffered.test",
    ):
        assert (tmp_path / "src" / "ingestion" / f"{module}.ts").is_file()
    assert '"src/ingestion/index.ts"' in (tmp_path / "tsdown.config.ts").read_text()
