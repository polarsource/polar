import json
import pathlib
import shutil
import subprocess

GENERATOR_DIR = pathlib.Path(__file__).parent.parent
ROOT = GENERATOR_DIR.parent.parent


def _run_openapi_generator(*arguments: str) -> str:
    result = subprocess.run(
        [
            "uv",
            "run",
            "-m",
            "--directory",
            str(ROOT / "server"),
            "scripts.generate_openapi",
            *arguments,
        ],
        cwd=GENERATOR_DIR,
        capture_output=True,
        text=True,
        check=True,
    )
    return result.stdout


def generate_openapi(output: pathlib.Path) -> None:
    if output.exists():
        if not output.is_dir():
            raise ValueError(f"Output path {output} is not a directory.")
        shutil.rmtree(output)
    output.mkdir(parents=True, exist_ok=True)
    versions = _run_openapi_generator("versions").splitlines()
    for version in versions:
        schema = json.loads(_run_openapi_generator("generate", version))
        (output / f"{version}.openapi.json").write_text(
            json.dumps(schema, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
