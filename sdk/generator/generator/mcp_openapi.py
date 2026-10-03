import json
import pathlib
import tempfile

from generator.openapi_overlay import remove_private_operations


def generate_mcp_openapi(
    openapi_files: list[pathlib.Path], output_path: pathlib.Path
) -> None:
    output_path.mkdir(parents=True, exist_ok=True)
    for openapi_file in openapi_files:
        openapi_spec_dict = json.loads(openapi_file.read_text(encoding="utf-8"))

        with tempfile.TemporaryDirectory(
            dir=output_path, prefix="openapi-generation-"
        ) as temporary_directory:
            temporary_path = pathlib.Path(temporary_directory)
            final_path = temporary_path / "openapi.json"
            remove_private_operations(
                openapi_file, openapi_spec_dict, temporary_path, final_path
            )
            final_path.replace(output_path / openapi_file.name)
