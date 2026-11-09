import json
import pathlib
import runpy
import sys
import typing

from polar.config.config import Config
from polar.{{ latest }}.inputs import Config as ConfigDict

CONFIG_VARIABLE = "config"


def load(file: pathlib.Path) -> ConfigDict:
    """Run a polarfile and return the config it assigns to `config`, as the API's dict."""
    namespace = runpy.run_path(str(file), run_name="polarfile")
    config = namespace.get(CONFIG_VARIABLE)
    if isinstance(config, Config):
        return config.to_dict()
    if isinstance(config, dict):
        return typing.cast(ConfigDict, config)
    raise SystemExit(
        f"{file.name} must assign the config to a variable named `{CONFIG_VARIABLE}`, "
        "for example `config = Config(meters=Meters, products=Products)`."
    )


def main(argv: list[str]) -> None:
    if len(argv) != 1:
        raise SystemExit("usage: python -m polar.config <polarfile.py>")
    file = pathlib.Path(argv[0]).resolve()
    sys.path.insert(0, str(file.parent))
    json.dump(load(file), sys.stdout, indent=2)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main(sys.argv[1:])
