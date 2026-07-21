import json
import pathlib
import subprocess
import tempfile
import typing

import openapi_pydantic as op

from generator.code_samples import generate_code_samples_overlay
from generator.ir import generate_ir
from generator.openapi import ROOT, generate_openapi


HTTP_METHODS = frozenset(
    {"delete", "get", "head", "options", "patch", "post", "put", "trace"}
)
DOCS_OPENAPI_PATH = ROOT / "docs" / "openapi.json"


def generate_private_operations_overlay(
    schema: dict[str, typing.Any],
) -> dict[str, typing.Any]:
    actions: list[dict[str, typing.Any]] = []
    for section_name in ("paths", "webhooks"):
        section = schema.get(section_name, {})
        if not isinstance(section, dict):
            continue
        for path, path_item in section.items():
            if not isinstance(path_item, dict):
                continue
            operations = {
                method: operation
                for method, operation in path_item.items()
                if method in HTTP_METHODS and isinstance(operation, dict)
            }
            private_methods = [
                method
                for method, operation in operations.items()
                if "private" in operation.get("tags", [])
            ]
            if not private_methods:
                continue
            path_target = f"$[{json.dumps(section_name)}][{json.dumps(path)}]"
            if len(private_methods) == len(operations):
                actions.append({"target": path_target, "remove": True})
                continue
            actions.extend(
                {
                    "target": f"{path_target}[{json.dumps(method)}]",
                    "remove": True,
                }
                for method in private_methods
            )

    version = schema.get("info", {}).get("version", "0.0.0")
    return {
        "overlay": "1.1.0",
        "info": {
            "title": "Remove private API operations",
            "version": version,
        },
        "actions": actions,
    }


def apply_overlay(
    openapi_path: pathlib.Path,
    overlay_path: pathlib.Path,
    output_path: pathlib.Path,
) -> None:
    subprocess.run(
        [
            "oas-patch",
            "overlay",
            str(openapi_path),
            str(overlay_path),
            "-o",
            str(output_path),
        ],
        check=True,
    )


def generate_docs_openapi(
    output_path: pathlib.Path = DOCS_OPENAPI_PATH,
    sdk_version: str = "0.0.0",
    source_path: pathlib.Path | None = None,
) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(
        dir=output_path.parent, prefix="openapi-generation-"
    ) as temporary_directory:
        temporary_path = pathlib.Path(temporary_directory)
        generated_source_path = temporary_path / "source.json"
        samples_overlay_path = temporary_path / "samples.overlay.json"
        samples_path = temporary_path / "samples.json"
        private_overlay_path = temporary_path / "private.overlay.json"
        final_path = temporary_path / "openapi.json"

        if source_path is None:
            generate_openapi(generated_source_path)
            source_path = generated_source_path
        schema = json.loads(source_path.read_text(encoding="utf-8"))
        spec = op.OpenAPI.model_validate(schema)
        ir = generate_ir(spec)
        if len(ir.versions) != 1:
            raise ValueError(
                "The docs OpenAPI schema must contain exactly one API version"
            )

        samples_overlay = generate_code_samples_overlay(
            ir.versions[0], sdk_version, ["python", "typescript"]
        )
        samples_overlay_path.write_text(
            json.dumps(samples_overlay, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        apply_overlay(source_path, samples_overlay_path, samples_path)

        private_overlay = generate_private_operations_overlay(schema)
        private_overlay_path.write_text(
            json.dumps(private_overlay, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        apply_overlay(samples_path, private_overlay_path, final_path)

        final_path.replace(output_path)
