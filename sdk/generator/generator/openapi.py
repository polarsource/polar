import json
import pathlib
import subprocess


GENERATOR_DIR = pathlib.Path(__file__).parent.parent
ROOT = GENERATOR_DIR.parent.parent


def generate_openapi(output: pathlib.Path) -> None:
    result = subprocess.run(
        [
            "uv",
            "run",
            "-m",
            "--directory",
            str(ROOT / "server"),
            "scripts.generate_openapi",
        ],
        cwd=GENERATOR_DIR,
        capture_output=True,
        text=True,
        check=True,
    )
    schema = json.loads(result.stdout)
    output.write_text(
        json.dumps(schema, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
