"""Flag request-derived values flowing into frontend URL construction.

`settings.generate_frontend_url()` concatenates its argument onto
`FRONTEND_BASE_URL` with no validation, so a request-derived value passed to it
is an open redirect: `?return_path=@evil.com` yields
`https://polar.sh@evil.com`, which browsers navigate to as `evil.com` (`@` is
the userinfo delimiter). Request-derived paths must go through
`get_safe_return_url` (`polar.kit.http`) instead.

Rules (per function, intra-procedural):
- A parameter is *tainted* when declared with a FastAPI request marker
  (`Query`/`Path`/`Form`/`Header`/`Cookie`/`Body`), either as a default value
  or inside `Annotated[...]` metadata. Assigning an expression that references
  a tainted name to a local taints that local (fixed-point propagation).
- Flag `generate_frontend_url(...)` calls whose arguments reference a tainted
  name.
- Flag f-strings or `+` concatenations that combine `FRONTEND_BASE_URL` with a
  tainted name — the inlined form of the same bug.
- `# noqa: frontend-url` on the offending line is an explicit escape for
  values already validated upstream.

Exits 1 on any violation.
"""

from __future__ import annotations

import ast
import re
import sys
from pathlib import Path

NOQA_MARKER = "frontend-url"
TARGET_CALL = "generate_frontend_url"
BASE_URL_SETTING = "FRONTEND_BASE_URL"
FASTAPI_PARAM_MARKERS = frozenset({"Query", "Path", "Form", "Header", "Cookie", "Body"})

CALL_MESSAGE = (
    "request-derived value passed to generate_frontend_url — it concatenates "
    "without validation (open redirect). Route it through get_safe_return_url "
    "(polar.kit.http). Escape with `# noqa: frontend-url` if already validated."
)

CONCAT_MESSAGE = (
    "request-derived value concatenated with FRONTEND_BASE_URL — open "
    "redirect. Route it through get_safe_return_url (polar.kit.http). Escape "
    "with `# noqa: frontend-url` if already validated."
)

_NOQA_RE = re.compile(r"#\s*noqa(?::\s*(?P<codes>[^#]*))?", re.IGNORECASE)

FunctionNode = ast.FunctionDef | ast.AsyncFunctionDef


def _is_fastapi_marker(node: ast.AST | None) -> bool:
    if not isinstance(node, ast.Call):
        return False
    func = node.func
    if isinstance(func, ast.Name):
        return func.id in FASTAPI_PARAM_MARKERS
    if isinstance(func, ast.Attribute):
        return func.attr in FASTAPI_PARAM_MARKERS
    return False


def _annotation_has_marker(node: ast.AST | None) -> bool:
    if node is None:
        return False
    return any(_is_fastapi_marker(child) for child in ast.walk(node))


def _tainted_params(func: FunctionNode) -> set[str]:
    """Parameters declared with a FastAPI request marker."""
    args = func.args
    positional = args.posonlyargs + args.args
    defaults: list[ast.expr | None] = [None] * (
        len(positional) - len(args.defaults)
    ) + list(args.defaults)
    tainted: set[str] = set()
    for arg, default in zip(
        positional + args.kwonlyargs, defaults + list(args.kw_defaults)
    ):
        if _is_fastapi_marker(default) or _annotation_has_marker(arg.annotation):
            tainted.add(arg.arg)
    return tainted


def _references_any(node: ast.AST, names: set[str]) -> bool:
    return any(
        isinstance(child, ast.Name) and child.id in names for child in ast.walk(node)
    )


def _propagate(func: FunctionNode, tainted: set[str]) -> set[str]:
    """Fixed-point: a local assigned from a tainted expression is tainted."""
    changed = True
    while changed:
        changed = False
        for node in ast.walk(func):
            value: ast.expr | None
            targets: list[ast.expr]
            if isinstance(node, ast.Assign):
                value, targets = node.value, node.targets
            elif isinstance(node, (ast.AnnAssign, ast.AugAssign)):
                value, targets = node.value, [node.target]
            elif isinstance(node, ast.NamedExpr):
                value, targets = node.value, [node.target]
            else:
                continue
            if value is None or not _references_any(value, tainted):
                continue
            for target in targets:
                for child in ast.walk(target):
                    if isinstance(child, ast.Name) and child.id not in tainted:
                        tainted.add(child.id)
                        changed = True
    return tainted


def _is_target_call(node: ast.Call) -> bool:
    func = node.func
    if isinstance(func, ast.Attribute):
        return func.attr == TARGET_CALL
    return isinstance(func, ast.Name) and func.id == TARGET_CALL


def _references_base_url(node: ast.AST) -> bool:
    return any(
        isinstance(child, ast.Attribute) and child.attr == BASE_URL_SETTING
        for child in ast.walk(node)
    )


def check_function(func: FunctionNode) -> list[tuple[int, str]]:
    tainted = _tainted_params(func)
    if not tainted:
        return []
    tainted = _propagate(func, tainted)

    violations: list[tuple[int, str]] = []
    seen_lines: set[int] = set()
    for node in ast.walk(func):
        if isinstance(node, ast.Call) and _is_target_call(node):
            if not any(_references_any(arg, tainted) for arg in node.args):
                continue
            message = CALL_MESSAGE
        elif isinstance(node, (ast.JoinedStr, ast.BinOp)):
            if not (_references_base_url(node) and _references_any(node, tainted)):
                continue
            message = CONCAT_MESSAGE
        else:
            continue
        if node.lineno in seen_lines:
            continue
        seen_lines.add(node.lineno)
        violations.append((node.lineno, message))
    return violations


def _line_has_noqa(source_lines: list[str], lineno: int) -> bool:
    idx = lineno - 1
    if not (0 <= idx < len(source_lines)):
        return False
    match = _NOQA_RE.search(source_lines[idx])
    if match is None:
        return False
    codes = match.group("codes")
    if codes is None:
        return True
    return NOQA_MARKER in {code.strip() for code in codes.split(",")}


def check_file(path: Path) -> list[tuple[Path, int, str]]:
    source = path.read_text()
    try:
        tree = ast.parse(source, filename=str(path))
    except SyntaxError as exc:
        return [(path, exc.lineno or 0, f"syntax error: {exc.msg}")]

    source_lines = source.splitlines()
    violations: list[tuple[Path, int, str]] = []
    for node in ast.walk(tree):
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        for lineno, message in check_function(node):
            if _line_has_noqa(source_lines, lineno):
                continue
            violations.append((path, lineno, message))
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

    print(f"OK: {checked} file(s) checked, no frontend-url violations.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
