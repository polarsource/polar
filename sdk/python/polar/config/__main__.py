import argparse
import contextlib
import json
import pathlib
import runpy
import sys

from polar.config import Config

if __name__ == "__main__":
    parser = argparse.ArgumentParser(prog="python -m polar.config")
    commands = parser.add_subparsers(dest="command", required=True)
    load = commands.add_parser("load", help="Print a config file as JSON.")
    load.add_argument("file", type=pathlib.Path)
    arguments = parser.parse_args()

    sys.path.insert(0, str(arguments.file.resolve().parent))
    with contextlib.redirect_stdout(sys.stderr):
        config = runpy.run_path(str(arguments.file)).get("config")
    if not isinstance(config, Config):
        sys.exit(f"{arguments.file} must assign a Config to a variable named `config`.")
    print(json.dumps(config.to_dict(), allow_nan=False))
