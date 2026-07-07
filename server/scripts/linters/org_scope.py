"""Flag membership resolution that bypasses the session org down-scope.

Resolving "which organizations can this subject access?" must go through the
**scope-aware** helpers so the session/token down-scope (`organization_ids`) is
always applied: `select_accessible_org_ids(auth_subject)` (subquery) or
`get_accessible_org_ids(...)` (service), and `get_accessible_organization(...)`
for a single org. The *raw* helpers (`select_user_org_ids`,
`get_organizations_with_role`) answer plain membership with **no** down-scope, so
using them where an `auth_subject` is in play silently leaks other orgs (see the
`/me` org-switcher regression).

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
"""

from __future__ import annotations

import ast
from typing import TypeGuard

from .base import Rule, Violation

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


def check(tree: ast.Module) -> list[Violation]:
    violations: list[Violation] = []
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

        if node.lineno in seen_lines:  # one query can match multiple branches
            continue
        seen_lines.add(node.lineno)

        violations.append((node.lineno, message))

    return violations


RULE = Rule(
    name="org-scope",
    noqa_code="org-scope",
    summary="flag inline UserOrganization filters that bypass select_user_org_ids",
    check=check,
)
