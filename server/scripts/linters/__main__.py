"""Run the custom AST lint rules over polar/ with a single shared parse.

Each rule lives in its own module and registers a `Rule` with a name (for
`--only`), a noqa code, and a `check(tree)` callable. Suppress a violation
with `# noqa: <code>` on the offending line. Exits 1 on any violation.
"""

from __future__ import annotations

import argparse
import ast
import sys
from pathlib import Path

from . import frontend_url, org_scope, subquery
from .base import Rule, line_has_noqa

RULES: tuple[Rule, ...] = (subquery.RULE, org_scope.RULE, frontend_url.RULE)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--only",
        metavar="RULE",
        help=f"comma-separated rule names to run ({', '.join(r.name for r in RULES)})",
    )
    args = parser.parse_args()

    if args.only is None:
        rules = RULES
    else:
        names = {name.strip() for name in args.only.split(",")}
        unknown = names - {rule.name for rule in RULES}
        if unknown:
            print(
                f"error: unknown rule(s): {', '.join(sorted(unknown))}", file=sys.stderr
            )
            return 2
        rules = tuple(rule for rule in RULES if rule.name in names)

    root = Path(__file__).resolve().parents[2] / "polar"
    if not root.exists():
        print(f"error: {root} not found", file=sys.stderr)
        return 2

    checked = 0
    violations: list[tuple[Path, int, str, str]] = []
    for path in sorted(root.rglob("*.py")):
        if "migrations" in path.parts:
            continue
        checked += 1
        source = path.read_text()
        try:
            tree = ast.parse(source, filename=str(path))
        except SyntaxError as exc:
            violations.append(
                (path, exc.lineno or 0, "syntax", f"syntax error: {exc.msg}")
            )
            continue
        source_lines = source.splitlines()
        for rule in rules:
            for lineno, message in rule.check(tree):
                if line_has_noqa(source_lines, lineno, rule.noqa_code):
                    continue
                violations.append((path, lineno, rule.name, message))

    if violations:
        violations.sort(key=lambda v: (v[0], v[1]))
        for path, lineno, name, message in violations:
            try:
                rel = path.relative_to(Path.cwd())
            except ValueError:
                rel = path
            print(f"{rel}:{lineno}: [{name}] {message}")
        print(f"\n{len(violations)} violation(s) across {checked} file(s).")
        return 1

    rule_names = ", ".join(rule.name for rule in rules)
    print(f"OK: {checked} file(s) checked against {rule_names}, no violations.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
