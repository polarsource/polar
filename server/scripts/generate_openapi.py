import argparse
import json
import os
import sys

# Force `zoneinfo` to ignore system tzdata and use the bundled `tzdata` PyPI
# package, so the OpenAPI timezone enum is identical across CI and dev machines.
os.environ["PYTHONTZPATH"] = ""

from polar.api import router
from polar.kit.versioning import (
    APIVersion,
    finalize_versioned_routes,
    routes_for_version,
)
from polar.openapi import get_openapi
from polar.version import CURRENT_API_VERSION, VERSIONS

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "version",
        nargs="?",
        type=APIVersion.parse,
        default=CURRENT_API_VERSION,
    )
    arguments = parser.parse_args()

    finalize_versioned_routes(router.routes, VERSIONS)
    schema = get_openapi(
        arguments.version,
        routes_for_version(router.routes, arguments.version),
    )
    json.dump(schema, sys.stdout)
    sys.stdout.flush()
