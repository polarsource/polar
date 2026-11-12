import argparse
import contextlib
import json
import pathlib
import runpy
import sys

from polar.config import Config
from polar.config.render import render
from polar.config.source import MODULE, positions


def load(file: pathlib.Path) -> None:
    sys.path.insert(0, str(file.resolve().parent))
    with contextlib.redirect_stdout(sys.stderr):
        config = runpy.run_path(str(file), run_name=MODULE).get("config")
    if not isinstance(config, Config):
        sys.exit(f"{file} must assign a Config to a variable named `config`.")
    loaded = {"config": config.to_dict(), "positions": positions(config, file)}
    print(json.dumps(loaded, allow_nan=False))


def write() -> None:
    try:
        print(render(json.load(sys.stdin)), end="")
    except ValueError as error:
        sys.exit(str(error))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(prog="python -m polar.config")
    commands = parser.add_subparsers(dest="command", required=True)
    loading = commands.add_parser(
        "load",
        help="Print a config file, and where it declares each entry, as JSON.",
    )
    loading.add_argument("file", type=pathlib.Path)
    commands.add_parser(
        "render",
        help="Read a config as JSON on stdin and print it as a Python config file.",
    )
    arguments = parser.parse_args()

    if arguments.command == "load":
        load(arguments.file)
    else:
        write()
