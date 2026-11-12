import ast
import math
import pathlib
import typing

from polar.config import Config, MeterSet

MODULE = "__polar_config__"

POSITIONAL = ("name",)
FIELDS = {"on": "filter", "where": "filter", "aggregate": "aggregation"}


class Span(typing.TypedDict):
    line: int
    column: int
    length: int


class Value(typing.TypedDict):
    value: str | int | float
    span: Span


class Field(typing.TypedDict):
    key: Span
    values: list[Value]


class Entry(typing.TypedDict):
    name: Span
    fields: dict[str, Field]


class Positions(typing.TypedDict):
    sections: dict[str, Span]
    entries: dict[str, list[Entry | None]]


def positions(config: Config, file: pathlib.Path) -> Positions:
    """Where the config file declares each section and entry.

    The entries of a section are in the order `Config.to_dict` lists them. One
    declared in another file is `None`.
    """
    source = file.read_text(encoding="utf-8")
    lines = source.split("\n")
    statements = list(_statements(ast.parse(source).body))
    classes = {
        statement.name: statement
        for statement in statements
        if isinstance(statement, ast.ClassDef)
    }
    return {
        "sections": _sections(statements, lines),
        "entries": {"meters": _entries(config.meters, classes, lines)},
    }


def _statements(body: list[ast.stmt]) -> typing.Iterator[ast.stmt]:
    for statement in body:
        yield statement
        if isinstance(statement, ast.ClassDef | ast.FunctionDef | ast.AsyncFunctionDef):
            continue
        for block in ("body", "orelse", "finalbody"):
            yield from _statements(getattr(statement, block, []))
        for branch in (
            *getattr(statement, "handlers", []),
            *getattr(statement, "cases", []),
        ):
            yield from _statements(branch.body)


def _sections(statements: list[ast.stmt], lines: list[str]) -> dict[str, Span]:
    for statement in reversed(statements):
        if (
            isinstance(statement, ast.Assign)
            and isinstance(statement.value, ast.Call)
            and any(_named(target, "config") for target in statement.targets)
        ):
            return {
                keyword.arg: _key(keyword, lines)
                for keyword in statement.value.keywords
                if keyword.arg
            }
    return {}


def _entries(
    declared_on: type[MeterSet] | None,
    classes: dict[str, ast.ClassDef],
    lines: list[str],
) -> list[Entry | None]:
    if declared_on is None:
        return []
    return [
        _entry(declared_on, attribute, classes, lines)
        for attribute in declared_on._entries()
    ]


def _entry(
    declared_on: type,
    attribute: str,
    classes: dict[str, ast.ClassDef],
    lines: list[str],
) -> Entry | None:
    owner = next(base for base in declared_on.__mro__ if attribute in vars(base))
    declared_here = owner.__module__ == MODULE and owner.__qualname__ in classes
    if not declared_here:
        return None
    assignments = [
        (statement, target)
        for statement in _statements(classes[owner.__qualname__].body)
        if isinstance(statement, ast.Assign | ast.AnnAssign)
        for target in (
            statement.targets
            if isinstance(statement, ast.Assign)
            else [statement.target]
        )
        if _named(target, attribute)
    ]
    if not assignments:
        return None
    statement, target = assignments[-1]
    return {"name": _span(target, lines), "fields": _fields(statement.value, lines)}


def _fields(value: ast.expr | None, lines: list[str]) -> dict[str, Field]:
    if not isinstance(value, ast.Call):
        return {}
    positional = [
        (name, _span(argument, lines), argument)
        for name, argument in zip(POSITIONAL, value.args, strict=False)
    ]
    keywords = [
        (FIELDS.get(keyword.arg, keyword.arg), _key(keyword, lines), keyword.value)
        for keyword in value.keywords
        if keyword.arg
    ]
    fields: dict[str, Field] = {}
    for name, key, argument in [*positional, *keywords]:
        field = fields.setdefault(name, {"key": key, "values": []})
        field["values"] += _constants(argument, lines)
    return fields


def _constants(expression: ast.expr, lines: list[str]) -> list[Value]:
    constants = sorted(
        (node for node in ast.walk(expression) if isinstance(node, ast.Constant)),
        key=lambda node: (node.lineno, node.col_offset),
    )
    values: list[Value] = []
    for node in constants:
        value = node.value
        finite = isinstance(value, float) and math.isfinite(value)
        if isinstance(value, str | int) or finite:
            values.append({"value": value, "span": _span(node, lines)})
    return values


def _named(target: ast.expr, name: str) -> typing.TypeGuard[ast.Name]:
    return isinstance(target, ast.Name) and target.id == name


def _key(keyword: ast.keyword, lines: list[str]) -> Span:
    start = keyword.col_offset
    end = start + len((keyword.arg or "").encode())
    return _characters(lines, keyword.lineno, start, end)


def _span(node: ast.expr, lines: list[str]) -> Span:
    to_line_end = len(lines[node.lineno - 1].encode())
    one_line = node.end_lineno == node.lineno and node.end_col_offset is not None
    end = node.end_col_offset if one_line else to_line_end
    return _characters(lines, node.lineno, node.col_offset, end or to_line_end)


def _characters(lines: list[str], lineno: int, start: int, end: int) -> Span:
    line = lines[lineno - 1].encode()
    return {
        "line": lineno,
        "column": len(line[:start].decode()) + 1,
        "length": len(line[start:end].decode()),
    }
