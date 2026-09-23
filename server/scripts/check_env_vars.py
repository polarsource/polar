"""Report `POLAR_*` variables Terraform provisions that nothing reads.

The drift starts when a reader goes away: the setting leaves `config.py`, the
Terraform that provisions it stays, and `extra="allow"` means the app never
complains. A credential nobody reads is a credential nobody watches.

Exit codes follow the linter convention: 0 clean, 1 orphans found, 2 the check
itself failed. Run it from `server/`:

    uv run python -m scripts.check_env_vars
"""

import ast
import re
import subprocess
import sys
import traceback
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
CONFIG = REPO / "server" / "polar" / "config.py"

NAME = re.compile(r"POLAR_[A-Z0-9_]+")

# Read somewhere this script cannot see.
ALLOWED: frozenset[str] = frozenset()


def _grep(*paths: str) -> set[str]:
    result = subprocess.run(
        ["git", "grep", "-hoE", NAME.pattern, "--", *paths],
        cwd=REPO,
        capture_output=True,
        text=True,
        check=False,  # git grep exits 1 when it matches nothing
    )
    return set(result.stdout.split())


def provisioned() -> set[str]:
    return _grep("terraform/**/*.tf")


def read() -> set[str]:
    tree = ast.parse(CONFIG.read_text())
    settings = next(
        (
            node
            for node in ast.walk(tree)
            if isinstance(node, ast.ClassDef) and node.name == "Settings"
        ),
        None,
    )
    if settings is None:
        raise RuntimeError(f"No Settings class in {CONFIG}")
    fields = {
        f"POLAR_{statement.target.id}"
        for statement in settings.body
        if isinstance(statement, ast.AnnAssign)
        and isinstance(statement.target, ast.Name)
    }
    return fields | _grep("clients", "server")


def main() -> int:
    orphans = provisioned() - read() - ALLOWED
    if not orphans:
        print("OK: every POLAR_* variable Terraform sets is read.")
        return 0

    print(f"{len(orphans)} POLAR_* variable(s) provisioned but never read:\n")
    for name in sorted(orphans):
        print(f"  {name}")
    print(
        "\nRemove them from terraform/, or add them to ALLOWED in this script "
        "with a reason."
    )
    return 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:
        # 2 separates "the check broke" from "the check found something".
        traceback.print_exc()
        sys.exit(2)
