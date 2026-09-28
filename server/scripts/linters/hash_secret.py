"""Flag direct reads of the token hashing secret settings.

In production the secret set comes from Secrets Manager, and `HASH_SECRETS`
and `CURRENT_HASH_SECRET_ID` stay unset. Reading either through `settings`
therefore answers `{}` and `None` there, silently: a lookup rewrites every hit
to the bare legacy digest instead of the current secret, undoing the rotation
it was meant to complete.

`polar.kit.hash_secrets.get_hash_secrets` is the one place that decides where
the set comes from, and `get_current_secret_id` reads the id off it. The
settings only exist for local development and tests, where that resolver falls
back to them.

`config.py` reads them as `self.*` inside its validator, which this rule does
not match. `# lint-skip: hash-secret` on the offending line is the escape, and
the resolver itself is the only legitimate user.
"""

import ast

from .base import Rule, Violation

SETTINGS_NAME = "settings"
GUARDED_ATTRIBUTES = frozenset({"HASH_SECRETS", "CURRENT_HASH_SECRET_ID"})

MESSAGE = (
    "reads settings.{attribute} directly — it is unset in production, where "
    "the set comes from Secrets Manager. Use get_hash_secrets() or "
    "get_current_secret_id() (polar.kit.crypto)."
)


def check(tree: ast.Module) -> list[Violation]:
    violations: list[Violation] = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.Attribute):
            continue
        if node.attr not in GUARDED_ATTRIBUTES:
            continue
        value = node.value
        if isinstance(value, ast.Name) and value.id == SETTINGS_NAME:
            violations.append((node.lineno, MESSAGE.format(attribute=node.attr)))
    return violations


RULE = Rule(
    name="hash-secret",
    skip_code="hash-secret",
    summary="flag direct reads of the token hashing secret settings",
    check=check,
)
