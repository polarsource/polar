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

# A variable added to terraform/ this recently is not reported: the Terraform
# often lands before the code that reads it.
GRACE_DAYS = 7


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


def added_recently(name: str) -> bool:
    """Whether `name` entered terraform/ within GRACE_DAYS.

    Needs history: on a shallow clone the oldest commit looks like it added
    everything, so we answer False and the variable is reported as before.
    """
    shallow = subprocess.run(
        ["git", "rev-parse", "--is-shallow-repository"],
        cwd=REPO,
        capture_output=True,
        text=True,
        check=False,
    )
    if shallow.returncode != 0 or shallow.stdout.strip() != "false":
        return False
    result = subprocess.run(
        [
            "git",
            "log",
            f"--since={GRACE_DAYS}.days",
            "--pickaxe-regex",
            f"-S(^|[^A-Z0-9_]){name}($|[^A-Z0-9_])",
            "--format=%H",
            "--",
            "terraform",
        ],
        cwd=REPO,
        capture_output=True,
        text=True,
        check=False,
    )
    return result.returncode == 0 and bool(result.stdout.strip())


def main() -> int:
    orphans = {
        name for name in provisioned() - read() - ALLOWED if not added_recently(name)
    }
    if not orphans:
        print("OK: every POLAR_* variable Terraform sets is read.")
        return 0

    print(f"{len(orphans)} POLAR_* variable(s) provisioned but never read:\n")
    for name in sorted(orphans):
        print(f"  {name}")
    print(
        f"\nRemove them from terraform/, or add them to ALLOWED in this script "
        f"with a reason. Variables added to terraform/ in the last {GRACE_DAYS} "
        "days are not reported."
    )
    return 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:
        # 2 separates "the check broke" from "the check found something".
        traceback.print_exc()
        sys.exit(2)
