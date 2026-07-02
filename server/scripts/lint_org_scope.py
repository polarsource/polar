"""Flag membership resolution that bypasses the session org down-scope.

Resolving "which organizations can this subject access?" must go through the
**scope-aware** helpers so the session/token down-scope (`organization_ids`) and
SSO enforcement are always applied: `select_accessible_org_ids(auth_subject)`
(subquery) or `get_accessible_org_ids(...)` (service), and
`get_accessible_organization(...)` for a single org. The *raw* helpers
(`select_user_org_ids`, `get_organizations_with_role`) answer plain membership
with **no** down-scope or SSO check, so using them where an `auth_subject` is in
play silently leaks other orgs (see the `/me` org-switcher regression).

Rules:
- Flag `select(UserOrganization.organization_id)` — hand-building the
  user→accessible-orgs subquery. `select_user_org_ids` is the sole blessed
  definition and marks itself with `# noqa: org-scope`.
- Flag a comparison where one operand is `UserOrganization.<col>` and another
  references `auth_subject` — the join-form bypass.
- Flag a **call** to a raw membership helper (`select_user_org_ids`,
  `get_organizations_with_role`). Prefer the scope-aware helpers; if the raw use
  is intentional (composing the scope-aware helper, manual intersection, or
  membership management on a plain `user_id`), mark it `# noqa: org-scope`.
- Membership *management* code (filtering by a plain `user_id`/`user.id`
  parameter, not `auth_subject`, and not projecting `organization_id`) is NOT
  flagged by the first two rules.
- `# noqa: org-scope` on the offending line is an explicit escape.

Exits 1 on any violation.
"""

from __future__ import annotations

import ast
import re
import sys
from pathlib import Path
from typing import TypeGuard

NOQA_MARKER = "org-scope"
MODEL_NAME = "UserOrganization"
SUBJECT_NAME = "auth_subject"

# Raw membership helpers that answer plain membership without applying the
# session/token down-scope. Calls to them must be scope-aware or acknowledged.
RAW_MEMBERSHIP_CALLS = frozenset({"select_user_org_ids", "get_organizations_with_role"})

EXPANSION_MESSAGE = (
    "hand-rolled UserOrganization membership expansion bypasses org-scope "
    "enforcement. Use select_accessible_org_ids(auth_subject) from "
    "polar.authz.repository (or get_accessible_org_ids). Escape with "
    "`# noqa: org-scope` if intentional."
)

RAW_CALL_MESSAGE = (
    "call to a raw membership helper bypasses the session org down-scope. Prefer "
    "select_accessible_org_ids / get_accessible_org_ids / "
    "get_accessible_organization. If the raw use is intentional (composing the "
    "scope-aware helper, manual intersection, or membership management), mark it "
    "`# noqa: org-scope`."
)

# Matches `# noqa` optionally followed by `: code1, code2`. A bare `# noqa`
# suppresses everything; a coded form only suppresses the listed codes.
_NOQA_RE = re.compile(r"#\s*noqa(?::\s*(?P<codes>[^#]*))?", re.IGNORECASE)


def _is_model_attr(node: ast.AST) -> TypeGuard[ast.Attribute]:
    """True for `UserOrganization.<attr>`, including a module-qualified base
    (e.g. `UserOrganization.user_id` or `models.UserOrganization.user_id`)."""
    if not isinstance(node, ast.Attribute):
        return False
    base = node.value
    if isinstance(base, ast.Name):
        return base.id == MODEL_NAME
    if isinstance(base, ast.Attribute):
        return base.attr == MODEL_NAME
    return False


def _references_subject(node: ast.AST) -> bool:
    """True if the subtree mentions the `auth_subject` name anywhere."""
    return any(
        isinstance(child, ast.Name) and child.id == SUBJECT_NAME
        for child in ast.walk(node)
    )


def _is_membership_expansion(node: ast.AST) -> bool:
    """True for a `select(...)` projecting `UserOrganization.organization_id` —
    hand-building the user→accessible-orgs subquery instead of calling the helper.
    Catches wrapped/unpacked forms too (e.g. `select(distinct(...))` or
    `select(UserOrganization.organization_id.label(...))`) by scanning each
    projected argument's subtree."""
    if not isinstance(node, ast.Call):
        return False
    func = node.func
    is_select = (isinstance(func, ast.Name) and func.id == "select") or (
        isinstance(func, ast.Attribute) and func.attr == "select"
    )
    if not is_select:
        return False
    return any(
        _is_model_attr(descendant) and descendant.attr == "organization_id"
        for arg in node.args
        for descendant in ast.walk(arg)
    )


def _is_raw_membership_call(node: ast.Call) -> bool:
    """True for a call to a raw membership helper — `select_user_org_ids(...)` or
    `<repo>.get_organizations_with_role(...)`."""
    func = node.func
    if isinstance(func, ast.Name):
        return func.id in RAW_MEMBERSHIP_CALLS
    if isinstance(func, ast.Attribute):
        return func.attr in RAW_MEMBERSHIP_CALLS
    return False


def _line_has_noqa(source_lines: list[str], lineno: int) -> bool:
    idx = lineno - 1
    if not (0 <= idx < len(source_lines)):
        return False
    match = _NOQA_RE.search(source_lines[idx])
    if match is None:
        return False
    codes = match.group("codes")
    if codes is None:  # bare `# noqa` suppresses everything
        return True
    return NOQA_MARKER in {code.strip() for code in codes.split(",")}


def check_file(path: Path) -> list[tuple[Path, int, str]]:
    """Return a list of (path, lineno, message) violations."""
    source = path.read_text()
    try:
        tree = ast.parse(source, filename=str(path))
    except SyntaxError as exc:
        return [(path, exc.lineno or 0, f"syntax error: {exc.msg}")]

    source_lines = source.splitlines()
    violations: list[tuple[Path, int, str]] = []
    seen_lines: set[int] = set()

    for node in ast.walk(tree):
        message: str | None = None
        if isinstance(node, ast.Call):
            if _is_membership_expansion(node):
                message = EXPANSION_MESSAGE
            elif _is_raw_membership_call(node):
                message = RAW_CALL_MESSAGE
            else:
                continue
        elif isinstance(node, ast.Compare):
            operands = [node.left, *node.comparators]
            if not any(_is_model_attr(op) for op in operands):
                continue
            if not any(_references_subject(op) for op in operands):
                continue
            message = EXPANSION_MESSAGE
        else:
            continue

        if _line_has_noqa(source_lines, node.lineno):
            continue

        if node.lineno in seen_lines:  # one query can match multiple branches
            continue
        seen_lines.add(node.lineno)

        violations.append((path, node.lineno, message))

    return violations


def main() -> int:
    root = Path(__file__).resolve().parent.parent / "polar"
    if not root.exists():
        print(f"error: {root} not found", file=sys.stderr)
        return 2

    checked = 0
    violations: list[tuple[Path, int, str]] = []
    for path in sorted(root.rglob("*.py")):
        if "migrations" in path.parts:
            continue
        checked += 1
        violations.extend(check_file(path))

    if violations:
        for path, lineno, message in violations:
            try:
                rel = path.relative_to(Path.cwd())
            except ValueError:
                rel = path
            print(f"{rel}:{lineno}: {message}")
        print(f"\n{len(violations)} violation(s) across {checked} file(s).")
        return 1

    print(f"OK: {checked} file(s) checked, no org-scope violations.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
