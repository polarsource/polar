import json
import pathlib
import tempfile

import openapi_pydantic as op

from generator.code_samples import generate_code_samples_overlay
from generator.ir import generate_ir
from generator.openapi import ROOT
from generator.openapi_overlay import apply_overlay, remove_private_operations

DOCS_OPENAPI_PATH = ROOT / "docs" / "openapi"


def generate_docs_openapi(
    openapi_files: list[pathlib.Path],
    output_path: pathlib.Path = DOCS_OPENAPI_PATH,
    sdk_version: str = "0.0.0",
) -> None:
    output_path.mkdir(parents=True, exist_ok=True)
    for openapi_file in openapi_files:
        openapi_spec_dict = json.loads(openapi_file.read_text(encoding="utf-8"))
        openapi_spec = op.OpenAPI.model_validate(openapi_spec_dict)
        ir = generate_ir(openapi_spec)

        with tempfile.TemporaryDirectory(
            dir=output_path, prefix="openapi-generation-"
        ) as temporary_directory:
            temporary_path = pathlib.Path(temporary_directory)
            samples_overlay_path = temporary_path / "samples.overlay.json"
            samples_path = temporary_path / "samples.json"
            final_path = temporary_path / "openapi.json"

            samples_overlay = generate_code_samples_overlay(
                ir.versions[0], sdk_version, ["python", "typescript"]
            )
            samples_overlay_path.write_text(
                json.dumps(samples_overlay, indent=2, ensure_ascii=False) + "\n",
                encoding="utf-8",
            )
            apply_overlay(openapi_file, samples_overlay_path, samples_path)

            remove_private_operations(
                samples_path,
                openapi_spec_dict,
                temporary_path,
                final_path,
            )

            final_path.replace(output_path / openapi_file.name)
