import argparse
import json
import os
import sys
from typing import Any

# Force `zoneinfo` to ignore system tzdata and use the bundled `tzdata` PyPI
# package, so the OpenAPI timezone enum is identical across CI and dev machines.
os.environ["PYTHONTZPATH"] = ""

from fastapi.routing import iter_route_contexts

from polar.kit.versioning import (
    APIVersion,
    finalize_versioned_routes,
    routes_for_version,
)
from polar.version import CURRENT_API_VERSION, VERSIONS


def generate_schemas(versions: list[APIVersion]) -> dict[str, dict[str, Any]]:
    from polar.api import router
    from polar.openapi import get_openapi
    from polar.webhook.webhooks import get_webhook_routes

    route_contexts = tuple(iter_route_contexts(router.routes))
    finalize_versioned_routes(route_contexts, VERSIONS)
    return {
        str(version): get_openapi(
            version,
            routes_for_version(route_contexts, version),
            get_webhook_routes(),
        )
        for version in versions
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    commands = parser.add_subparsers(dest="command")
    generate_parser = commands.add_parser("generate", help="Generate an OpenAPI schema")
    generate_parser.add_argument(
        "version",
        nargs="?",
        type=APIVersion.parse,
        default=CURRENT_API_VERSION,
    )
    generate_parser.add_argument("--private", action="store_true")
    commands.add_parser("versions", help="List available API versions")
    commands.add_parser(
        "generate-all",
        help="Generate the public OpenAPI schema of every version, keyed by version",
    )
    parser.set_defaults(command="generate", version=CURRENT_API_VERSION)

    arguments = parser.parse_args()
    if arguments.command == "versions":
        print(*(str(version) for version in sorted(VERSIONS)), sep="\n")
        sys.exit()

    if arguments.command == "generate-all":
        os.environ["POLAR_ENV"] = "testing"
        json.dump(generate_schemas(sorted(VERSIONS)), sys.stdout)
        sys.stdout.flush()
        sys.exit()

    if arguments.version not in VERSIONS:
        parser.error(f"Unsupported API version: {arguments.version}")

    if arguments.private:
        os.environ["POLAR_ENV"] = "development"
    else:
        os.environ["POLAR_ENV"] = "testing"

    schema = generate_schemas([arguments.version])[str(arguments.version)]
    json.dump(schema, sys.stdout)
    sys.stdout.flush()
