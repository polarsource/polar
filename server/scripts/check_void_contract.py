"""Check the SDK's pinned contract against the live Void API."""

import argparse
import json
from pathlib import Path

from polar.kit.versioning import APIVersion
from polar.void.openapi import get_void_openapi

CONTRACT = (
    Path(__file__).resolve().parents[2] / "clients/packages/void-sdk/openapi.json"
)
# The SDK sends this version in its Polar-Version request header.
SDK_API_VERSION = APIVersion.parse("2026-04")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--contract", type=Path, default=CONTRACT)
    arguments = parser.parse_args()
    schema = get_void_openapi(SDK_API_VERSION)
    if json.loads(arguments.contract.read_text()) != schema:
        parser.exit(
            1,
            "Void SDK contract is stale. Refresh the live contract for "
            f"{SDK_API_VERSION} and regenerate @void/sdk.\n",
        )
    operations = sum(
        "operationId" in operation
        for path in schema["paths"].values()
        for operation in path.values()
        if isinstance(operation, dict)
    )
    print(f"Void SDK contract matches {operations} live operations ({SDK_API_VERSION})")


if __name__ == "__main__":
    main()
