import argparse
import json
import os
import sys

# Force `zoneinfo` to ignore system tzdata and use the bundled `tzdata` PyPI
# package, so the OpenAPI timezone enum is identical across CI and dev machines.
os.environ["PYTHONTZPATH"] = ""

from fastapi.routing import iter_route_contexts

from polar.api import router
from polar.kit.versioning import (
    APIVersion,
    finalize_versioned_routes,
    routes_for_version,
)
from polar.openapi import get_openapi
from polar.version import CURRENT_API_VERSION, VERSIONS
from polar.webhook.webhooks import get_webhook_routes

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
    commands.add_parser("versions", help="List available API versions")
    parser.set_defaults(command="generate", version=CURRENT_API_VERSION)

    arguments = parser.parse_args()
    if arguments.command == "versions":
        print(*(str(version) for version in sorted(VERSIONS)), sep="\n")
        sys.exit()

    if arguments.version not in VERSIONS:
        parser.error(f"Unsupported API version: {arguments.version}")

    route_contexts = tuple(iter_route_contexts(router.routes))
    finalize_versioned_routes(route_contexts, VERSIONS)
    schema = get_openapi(
        arguments.version,
        routes_for_version(route_contexts, arguments.version),
        get_webhook_routes(),
    )
    json.dump(schema, sys.stdout)
    sys.stdout.flush()
