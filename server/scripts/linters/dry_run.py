"""Flag database scripts without a dry-run mode.

A script that writes to the database should let the operator preview what it
will change before it does. New scripts take `--execute` and dry-run without
it. Existing `--dry-run` and `--commit` flags (a `dry_run` or `commit`
parameter) also count.

The violation sits on the first database import. `# lint-skip: dry-run` there
exempts the script: read-only and local-only ones, and those that predate
this rule.
"""

import ast

from .base import Rule, Violation

DB_MODULES = frozenset(
    {"polar.kit.db.postgres", "polar.postgres", "sqlalchemy.ext.asyncio"}
)
DB_HELPERS = frozenset({"read_engine", "run_batched_update"})
DRY_RUN_PARAMETERS = frozenset({"dry_run", "execute", "commit"})

MESSAGE = (
    "database script without a dry-run mode — add an `--execute` option and "
    "dry-run without it, or "
    "`# lint-skip: dry-run` if it is read-only or local-only"
)


def _is_main_guard(node: ast.stmt) -> bool:
    return (
        isinstance(node, ast.If)
        and isinstance(node.test, ast.Compare)
        and isinstance(node.test.left, ast.Name)
        and node.test.left.id == "__name__"
    )


def _db_import_line(tree: ast.Module) -> int | None:
    for node in ast.walk(tree):
        if not isinstance(node, ast.ImportFrom) or node.module is None:
            continue
        if node.module in DB_MODULES:
            return node.lineno
        if node.module == "scripts.helper" and any(
            alias.name in DB_HELPERS for alias in node.names
        ):
            return node.lineno
    return None


def _has_dry_run_parameter(tree: ast.Module) -> bool:
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef | ast.AsyncFunctionDef):
            arguments = node.args.args + node.args.kwonlyargs
            if any(arg.arg in DRY_RUN_PARAMETERS for arg in arguments):
                return True
    return False


def check(tree: ast.Module) -> list[Violation]:
    if not any(_is_main_guard(node) for node in tree.body):
        return []
    lineno = _db_import_line(tree)
    if lineno is None or _has_dry_run_parameter(tree):
        return []
    return [(lineno, MESSAGE)]


RULE = Rule(
    name="dry-run",
    skip_code="dry-run",
    summary="flag database scripts without a dry-run mode",
    check=check,
    root="scripts",
)
