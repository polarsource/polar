#!/usr/bin/env python3
import platform
import re
import subprocess
import sys

"""
This script is intended to take in the stdin/stderr from the Dramatiq worker
like so:

    uv run task worker 2>&1 | uv run python ../dev/email_login_code_notifier.py

when the script encounters what looks like a login code, it'll show
a desktop notification with the code and copy the code to the clipboard.
"""


def main() -> None:
    # Only works on macOS
    assert platform.system() == "Darwin"

    # Pattern to match login codes in email
    pattern = re.compile(r">([0-9A-Z]{6})</p>")

    for line in sys.stdin:
        matches = pattern.findall(line)

        for match in matches:
            subprocess.run(
                [
                    "osascript",
                    "-e",
                    f'display notification "Found login code {match}. Copied to clipboard" with title "Polar login email" sound name "default"',
                    "-e",
                    f'set the clipboard to "{match}"',
                ]
            )

        # Also print the line to stdout to maintain stream flow
        print(line, end="", flush=True)


if __name__ == "__main__":
    main()
