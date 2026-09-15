import argparse
import json
import sys

from polar.kit.versioning import APIVersion
from polar.version import CURRENT_API_VERSION
from polar.void.openapi import get_void_openapi


def main() -> None:
    parser = argparse.ArgumentParser(description="Export the live Void-only API schema")
    parser.add_argument(
        "version", nargs="?", type=APIVersion.parse, default=CURRENT_API_VERSION
    )
    arguments = parser.parse_args()
    try:
        schema = get_void_openapi(arguments.version)
    except ValueError as error:
        parser.error(str(error))
    json.dump(schema, sys.stdout, indent=2)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
