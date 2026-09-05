import json
import pathlib
import subprocess
import tempfile
import typing

import openapi_pydantic as op

from generator.code_samples import generate_code_samples_overlay
from generator.ir import generate_ir
from generator.openapi import ROOT

HTTP_METHODS = frozenset(
    {"delete", "get", "head", "options", "patch", "post", "put", "trace"}
)
DOCS_OPENAPI_PATH = ROOT / "docs" / "openapi"
DATETIME_EXAMPLE = "2025-01-03T13:37:00.123456Z"


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


def generate_datetime_examples_overlay(
    schema: dict[str, typing.Any],
) -> dict[str, typing.Any]:
    schemas = schema.get("components", {}).get("schemas", {})
    actions = [
        {
            "target": _json_path(["components", "schemas", *path]),
            "update": {"examples": [DATETIME_EXAMPLE]},
        }
        for path in _iter_datetime_schemas_without_examples(schemas)
    ]

    version = schema.get("info", {}).get("version", "0.0.0")
    return {
        "overlay": "1.1.0",
        "info": {
            "title": "Add examples with fractional seconds to date-time schemas",
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
            private_overlay_path = temporary_path / "private.overlay.json"
            private_path = temporary_path / "private.json"
            datetime_overlay_path = temporary_path / "datetime.overlay.json"
            final_path = temporary_path / "openapi.json"

            samples_overlay = generate_code_samples_overlay(
                ir.versions[0], sdk_version, ["python", "typescript"]
            )
            samples_overlay_path.write_text(
                json.dumps(samples_overlay, indent=2, ensure_ascii=False) + "\n",
                encoding="utf-8",
            )
            apply_overlay(openapi_file, samples_overlay_path, samples_path)

            private_overlay = generate_private_operations_overlay(openapi_spec_dict)
            private_overlay_path.write_text(
                json.dumps(private_overlay, indent=2, ensure_ascii=False) + "\n",
                encoding="utf-8",
            )
            apply_overlay(samples_path, private_overlay_path, private_path)

            datetime_overlay = generate_datetime_examples_overlay(openapi_spec_dict)
            datetime_overlay_path.write_text(
                json.dumps(datetime_overlay, indent=2, ensure_ascii=False) + "\n",
                encoding="utf-8",
            )
            apply_overlay(private_path, datetime_overlay_path, final_path)

            final_path.replace(output_path / openapi_file.name)


def _iter_datetime_schemas_without_examples(
    node: typing.Any, path: tuple[str | int, ...] = ()
) -> typing.Iterator[tuple[str | int, ...]]:
    if isinstance(node, list):
        for index, item in enumerate(node):
            yield from _iter_datetime_schemas_without_examples(item, (*path, index))
        return
    if not isinstance(node, dict):
        return
    if _is_datetime_schema(node):
        if "examples" not in node and "example" not in node:
            yield path
        return
    for key, value in node.items():
        yield from _iter_datetime_schemas_without_examples(value, (*path, key))


def _is_datetime_schema(schema: dict[str, typing.Any]) -> bool:
    if schema.get("format") == "date-time":
        return True
    return any(
        isinstance(member, dict) and member.get("format") == "date-time"
        for keyword in ("anyOf", "oneOf")
        for member in schema.get(keyword, [])
    )


def _json_path(path: typing.Sequence[str | int]) -> str:
    return "$" + "".join(
        f"[{segment}]" if isinstance(segment, int) else f"[{json.dumps(segment)}]"
        for segment in path
    )
