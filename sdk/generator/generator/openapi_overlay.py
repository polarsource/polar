import json
import pathlib
import subprocess
import typing

HTTP_METHODS = frozenset(
    {"delete", "get", "head", "options", "patch", "post", "put", "trace"}
)


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


def remove_private_operations(
    openapi_path: pathlib.Path,
    openapi_spec_dict: dict[str, typing.Any],
    temporary_path: pathlib.Path,
    output_path: pathlib.Path,
) -> None:
    private_overlay_path = temporary_path / "private.overlay.json"
    private_overlay = generate_private_operations_overlay(openapi_spec_dict)
    private_overlay_path.write_text(
        json.dumps(private_overlay, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    apply_overlay(openapi_path, private_overlay_path, output_path)
