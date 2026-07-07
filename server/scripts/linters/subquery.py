"""Flag `.subquery()` calls that don't project explicit columns.

`select(Model).subquery()` re-materializes every mapped column on `Model`,
including those declared with `deferred=True`. This breaks count subqueries
when a deferred column is dropped at the DB level (the bug that caused the
sandbox Organization outage), and silently loads unused TSVECTOR/large-string
columns into every paginate count.

Rules:
- `.subquery()` is flagged when the receiver chain is rooted in
  `select(ModelName)` (single capitalized Name argument) and does not include
  `.with_only_columns(...)` or a union/intersect call. This is the bug-prone
  inline pattern.
- Variable-rooted chains (`statement.subquery()`) are NOT flagged — we can't
  statically determine the root. Those cases rely on the CLAUDE.md rule and
  code review. If you introduce a new variable-rooted `.subquery()` on an
  entity select, call `.with_only_columns(...)` explicitly.
- `# noqa: subquery-all-columns` on the call line is an explicit escape for
  cases where full-column projection is intentional.
"""

from __future__ import annotations

import ast

from .base import Rule, Violation

SAFE_NAMES = frozenset({"with_only_columns", "union", "union_all", "intersect"})

MESSAGE = (
    "call .with_only_columns(...) before .subquery(), or use "
    "count_subquery() from polar.kit.pagination. "
    "`deferred=True` does not propagate into .subquery(). "
    "Escape with `# noqa: subquery-all-columns` if full-column "
    "projection is intentional."
)


def _iter_chain_calls(node: ast.AST) -> list[ast.Call]:
    """Walk the receiver chain of a `.subquery()` call, collecting `Call`s.

    For `a.b().c().d().subquery()`, the receiver of `subquery` is `a.b().c().d()`;
    we descend through `Attribute.value` and `Call.func.value` to visit every
    `Call` in the chain.
    """
    calls: list[ast.Call] = []
    current: ast.AST | None = node
    while current is not None:
        if isinstance(current, ast.Call):
            calls.append(current)
            func = current.func
            if isinstance(func, ast.Attribute):
                current = func.value
            else:
                current = None
        elif isinstance(current, ast.Attribute):
            current = current.value
        else:
            current = None
    return calls


def _chain_is_safe(receiver: ast.AST) -> bool:
    """Return True if the chain clearly doesn't materialize an ORM entity.

    The bug-prone shape is `select(Model).subquery()`, which materializes every
    mapped column of `Model`. We only want to flag that pattern; explicit-
    column selects (`select(col1, col2, ...)`, `select(func.count())`) and
    union constructions are safe.
    """
    calls = _iter_chain_calls(receiver)

    # Column-narrowing or union anywhere in the chain → safe.
    for call in calls:
        func = call.func
        name = (
            func.attr if isinstance(func, ast.Attribute) else getattr(func, "id", None)
        )
        if name in SAFE_NAMES:
            return True

    # Find the root of the chain. If the root isn't a recognizable
    # `select(...)` on a single model-like Name, we can't confidently flag —
    # default to safe and let code review / noqa handle rare cases.
    if not calls:
        return True
    root = calls[-1]
    root_func = root.func
    is_select = (isinstance(root_func, ast.Name) and root_func.id == "select") or (
        isinstance(root_func, ast.Attribute) and root_func.attr == "select"
    )
    if not is_select:
        return True

    # Only flag `select(Model)` — single positional Name argument that looks
    # like an ORM class (leading uppercase). Any other argument shape
    # (explicit columns, labeled exprs, func.count(), etc.) is safe.
    if len(root.args) != 1 or root.keywords:
        return True
    arg = root.args[0]
    if isinstance(arg, ast.Name) and arg.id[:1].isupper():
        return False
    return True


def check(tree: ast.Module) -> list[Violation]:
    violations: list[Violation] = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        func = node.func
        if not isinstance(func, ast.Attribute) or func.attr != "subquery":
            continue
        if _chain_is_safe(func.value):
            continue
        violations.append((node.lineno, MESSAGE))
    return violations


RULE = Rule(
    name="subquery",
    noqa_code="subquery-all-columns",
    summary="flag .subquery() calls that don't narrow columns",
    check=check,
)
