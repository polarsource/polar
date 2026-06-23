"""Flag hand-rolled `UserOrganization` membership expansion.

Resolving "which organizations can this subject access?" must go through the
canonical helpers so a single definition stays enforceable — `select_user_org_ids`
(`polar.authz.repository`) for subquery use, or `get_accessible_org_ids`
(`polar.authz.service`). This matters ahead of session/token organization
scoping: those helpers are the one place the down-scope restriction is applied,
so a hand-rolled subquery silently bypasses it.

Rules:
- Flag `select(UserOrganization.organization_id)` — building the
  user→accessible-orgs subquery by hand. The canonical helper is the sole
  blessed exception and marks itself with `# noqa: org-scope`.
- Flag a comparison where one operand is `UserOrganization.<col>` and another
  references `auth_subject` (e.g. `UserOrganization.user_id ==
  auth_subject.subject.id`) — the join-form bypass that doesn't project
  `organization_id` directly.
- Membership *management* code (filtering by a plain `user_id`/`user.id`
  parameter, not `auth_subject`, and not projecting `organization_id`) is NOT
  flagged.
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
        if isinstance(node, ast.Call):
            if not _is_membership_expansion(node):
                continue
        elif isinstance(node, ast.Compare):
            operands = [node.left, *node.comparators]
            if not any(_is_model_attr(op) for op in operands):
                continue
            if not any(_references_subject(op) for op in operands):
                continue
        else:
            continue

        if _line_has_noqa(source_lines, node.lineno):
            continue

        if node.lineno in seen_lines:  # one query can match both branches
            continue
        seen_lines.add(node.lineno)

        violations.append(
            (
                path,
                node.lineno,
                "hand-rolled UserOrganization membership expansion bypasses "
                "org-scope enforcement. Use select_user_org_ids("
                "auth_subject.subject.id) from polar.authz.repository (or "
                "get_accessible_org_ids). Escape with `# noqa: org-scope` if "
                "intentional.",
            )
        )

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
