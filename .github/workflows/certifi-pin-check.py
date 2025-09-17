#!/usr/bin/env -S uv run

# /// script
# requires-python = ">=3.9"
# dependencies = [
#     "httpx",
#     "certifi>2025.1.31"
# ]
# ///
import argparse
import sys

import certifi
import httpx


def _check_website(url: str) -> bool:
    try:
        httpx.get(url, verify=certifi.where())
        return True
    except httpx.ConnectError:
        return False


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("url", help="URL to check")
    args = parser.parse_args()

    result = _check_website(args.url)
    # Fail if the check PASSES (meaning pinning certifi is NOT needed anymore)
    sys.exit(0 if not result else 1)
