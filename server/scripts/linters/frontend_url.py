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
  or inside `Annotated[...]` metadata. In route handlers (functions decorated
  with `@router.get(...)` etc.) every parameter is tainted unless it is a
  dependency (`Depends`/`Security`) or a framework object (`Request`, ...) —
  FastAPI treats bare `param: str` as a query parameter. Assigning an
  expression that references a tainted name to a local taints that local
  (fixed-point propagation). References inside comparisons don't propagate —
  comparing against user input selects a value, it doesn't let the input
  construct it.
- Flag `generate_frontend_url(...)` calls whose arguments reference a tainted
  name.
- Flag f-strings or `+` concatenations that combine `FRONTEND_BASE_URL` with a
  tainted name — the inlined form of the same bug.
- *Anchored* constructions are safe and not flagged: when the tainted value
  can only appear after a literal starting with "/" (`f"/auth/sso/{slug}"`),
  the resulting URL stays on the frontend origin no matter the value.
- `# lint-skip: frontend-url` on the offending line is an explicit escape for
  values already validated upstream.
"""

from __future__ import annotations

import ast

from .base import Rule, Violation

TARGET_CALL = "generate_frontend_url"
BASE_URL_SETTING = "FRONTEND_BASE_URL"
FASTAPI_PARAM_MARKERS = frozenset({"Query", "Path", "Form", "Header", "Cookie", "Body"})
ROUTE_METHODS = frozenset(
    {
        "get",
        "post",
        "put",
        "patch",
        "delete",
        "head",
        "options",
        "api_route",
        "websocket",
    }
)
DEPENDENCY_MARKERS = frozenset({"Depends", "Security"})
FRAMEWORK_PARAM_TYPES = frozenset(
    {"Request", "WebSocket", "Response", "BackgroundTasks"}
)

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


def _is_route_handler(func: FunctionNode) -> bool:
    return any(
        isinstance(decorator, ast.Call)
        and isinstance(decorator.func, ast.Attribute)
        and decorator.func.attr in ROUTE_METHODS
        for decorator in func.decorator_list
    )


def _mentions(node: ast.AST | None, names: frozenset[str]) -> bool:
    if node is None:
        return False
    return any(
        (isinstance(child, ast.Name) and child.id in names)
        or (isinstance(child, ast.Attribute) and child.attr in names)
        for child in ast.walk(node)
    )


def _tainted_params(func: FunctionNode) -> set[str]:
    """Parameters carrying request input: FastAPI-marker-declared ones, and in
    route handlers every non-dependency, non-framework parameter."""
    route_handler = _is_route_handler(func)
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
            continue
        if not route_handler or arg.arg in ("self", "cls"):
            continue
        if _mentions(default, DEPENDENCY_MARKERS):
            continue
        if _mentions(arg.annotation, DEPENDENCY_MARKERS | FRAMEWORK_PARAM_TYPES):
            continue
        tainted.add(arg.arg)
    return tainted


def _references_any(node: ast.AST, names: set[str]) -> bool:
    return any(
        isinstance(child, ast.Name) and child.id in names for child in ast.walk(node)
    )


def _references_any_outside_compare(node: ast.AST, names: set[str]) -> bool:
    inside_compare: set[int] = set()
    for child in ast.walk(node):
        if isinstance(child, ast.Compare):
            inside_compare.update(id(sub) for sub in ast.walk(child))
    return any(
        isinstance(child, ast.Name)
        and child.id in names
        and id(child) not in inside_compare
        for child in ast.walk(node)
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
            if value is None or _is_anchored(value):
                continue
            if not _references_any_outside_compare(value, tainted):
                continue
            for target in targets:
                for child in ast.walk(target):
                    if isinstance(child, ast.Name) and child.id not in tainted:
                        tainted.add(child.id)
                        changed = True
    return tainted


def _concat_terms(node: ast.expr) -> list[ast.expr]:
    """Flatten a string construction into its ordered terms: f-string parts
    (formatted values unwrapped) and `+` concatenation operands."""
    if isinstance(node, ast.JoinedStr):
        return [
            term
            for value in node.values
            for term in _concat_terms(
                value.value if isinstance(value, ast.FormattedValue) else value
            )
        ]
    if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Add):
        return _concat_terms(node.left) + _concat_terms(node.right)
    return [node]


def _is_path_literal(node: ast.expr) -> bool:
    return (
        isinstance(node, ast.Constant)
        and isinstance(node.value, str)
        and node.value.startswith("/")
    )


def _is_anchored(node: ast.expr) -> bool:
    terms = _concat_terms(node)
    return bool(terms) and _is_path_literal(terms[0])


def _is_anchored_after_base_url(node: ast.expr) -> bool:
    terms = _concat_terms(node)
    for index, term in enumerate(terms):
        if _references_base_url(term):
            rest = terms[index + 1 :]
            return bool(rest) and _is_path_literal(rest[0])
    return False


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


def _check_function(func: FunctionNode) -> list[Violation]:
    tainted = _tainted_params(func)
    if not tainted:
        return []
    tainted = _propagate(func, tainted)

    violations: list[Violation] = []
    seen_lines: set[int] = set()
    for node in ast.walk(func):
        if isinstance(node, ast.Call) and _is_target_call(node):
            operands = [*node.args, *(keyword.value for keyword in node.keywords)]
            if not any(
                not _is_anchored(operand) and _references_any(operand, tainted)
                for operand in operands
            ):
                continue
            message = CALL_MESSAGE
        elif isinstance(node, (ast.JoinedStr, ast.BinOp)):
            if not (_references_base_url(node) and _references_any(node, tainted)):
                continue
            if _is_anchored_after_base_url(node):
                continue
            message = CONCAT_MESSAGE
        else:
            continue
        if node.lineno in seen_lines:
            continue
        seen_lines.add(node.lineno)
        violations.append((node.lineno, message))
    return violations


def check(tree: ast.Module) -> list[Violation]:
    violations: list[Violation] = []
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            violations.extend(_check_function(node))
    return violations


RULE = Rule(
    name="frontend-url",
    noqa_code="frontend-url",
    summary="flag request-derived values passed to generate_frontend_url",
    check=check,
)
