"""Flag backoffice `tag.form(...)` blocks nested inside another form.

HTML5 forbids nested `<form>` elements. The parser drops the inner start tag and
reparents its children onto the outer form, so a "Cancel" button wrapped in
`<form method="dialog">` inside an `hx-post` form becomes a submit button of that
outer form: clicking Cancel performs the very action it was meant to abort.

A form is opened by `tag.form(...)` or by rendering a `forms.BaseForm` subclass
(`SomeForm.render(...)`, which emits the `<form>` element itself). Nesting is
detected lexically within a single function, which is how these views are
written.

Use `modal_close_button()` from `polar.backoffice.components` for dismiss
buttons, or move the inner form out so the two are siblings.
"""

from __future__ import annotations

import ast

from .base import Rule, Violation

MESSAGE = (
    "nested <form> element: HTML5 drops the inner form and reparents its "
    "buttons onto the outer one, so a Cancel button here submits the outer "
    "form. Use modal_close_button() from polar.backoffice.components, or make "
    "the two forms siblings. Escape with `# lint-skip: nested-form` if the "
    "nesting is intentional."
)


def _opens_form(item: ast.withitem) -> bool:
    """Return True if the `with` item renders a `<form>` element."""
    call = item.context_expr
    if not isinstance(call, ast.Call):
        return False
    func = call.func
    if not isinstance(func, ast.Attribute):
        return False
    if (
        func.attr == "form"
        and isinstance(func.value, ast.Name)
        and func.value.id == "tag"
    ):
        return True
    # `SomeForm.render(...)` renders the <form> element itself.
    return func.attr == "render" and "Form" in ast.dump(func.value)


class _Visitor(ast.NodeVisitor):
    """Track the lexical form nesting depth, resetting at each function body."""

    def __init__(self) -> None:
        self.depth = 0
        self.violations: list[Violation] = []

    def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
        outer_depth = self.depth
        self.depth = 0
        self.generic_visit(node)
        self.depth = outer_depth

    visit_AsyncFunctionDef = visit_FunctionDef  # type: ignore[assignment]

    def visit_With(self, node: ast.With) -> None:
        if any(_opens_form(item) for item in node.items):
            if self.depth > 0:
                self.violations.append((node.lineno, MESSAGE))
            self.depth += 1
            self.generic_visit(node)
            self.depth -= 1
        else:
            self.generic_visit(node)

    visit_AsyncWith = visit_With  # type: ignore[assignment]


def check(tree: ast.Module) -> list[Violation]:
    visitor = _Visitor()
    visitor.visit(tree)
    return visitor.violations


RULE = Rule(
    name="nested-form",
    skip_code="nested-form",
    summary="flag nested <form> elements in backoffice views",
    check=check,
)
