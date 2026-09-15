"""Compile metadata projections to data-only instructions for Tinybird."""

import json
import math
import re
from typing import Annotated

from pydantic import AfterValidator, JsonValue

NUMBER = r"(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?"
TOKEN = re.compile(r"\$[A-Za-z_][A-Za-z0-9_]*|" + NUMBER + r"|[()+*/-]|\S")
Instruction = tuple[str, str]


def compile_expression(expression: str) -> list[Instruction]:
    tokens = TOKEN.findall(expression)
    index = 0

    def peek() -> str:
        return tokens[index] if index < len(tokens) else ""

    def atom() -> list[Instruction]:
        nonlocal index
        token = peek()
        index += 1
        if token in ("+", "-"):
            return atom() + [("neg" if token == "-" else "pos", "")]
        if token == "(":
            result = add()
            if peek() != ")":
                raise ValueError(f"Invalid map expression: {expression!r}")
            index += 1
            return result
        if re.fullmatch(r"\$[A-Za-z_][A-Za-z0-9_]*", token):
            return [("ref", token[1:])]
        if re.fullmatch(NUMBER, token) and math.isfinite(float(token)):
            return [("number", token)]
        raise ValueError(f"Invalid map expression: {expression!r}")

    def multiply() -> list[Instruction]:
        nonlocal index
        result = atom()
        while peek() in ("*", "/"):
            operator = peek()
            index += 1
            result += atom() + [(operator, "")]
        return result

    def add() -> list[Instruction]:
        nonlocal index
        result = multiply()
        while peek() in ("+", "-"):
            operator = peek()
            index += 1
            result += multiply() + [(operator, "")]
        return result

    try:
        result = add()
    except RecursionError as exc:
        raise ValueError("Map expression is too complex") from exc
    if index != len(tokens):
        raise ValueError(f"Invalid map expression: {expression!r}")
    # Only a bare reference preserves arbitrary JSON types. Parenthesized or
    # signed references are numeric expressions.
    if (
        len(result) == 1
        and result[0][0] == "ref"
        and not re.fullmatch(r"\$[A-Za-z_][A-Za-z0-9_]*", expression)
    ):
        result.append(("pos", ""))
    return result


def validate_map(value: dict[str, JsonValue]) -> dict[str, JsonValue]:
    json.dumps(value, allow_nan=False)
    for item in value.values():
        if isinstance(item, str) and "$" in item:
            compile_expression(item)
    return value


EventMap = Annotated[dict[str, JsonValue], AfterValidator(validate_map)]


def compile_map(
    mapping: dict[str, JsonValue] | None,
) -> list[tuple[str, str, list[Instruction]]] | None:
    """Each field is (key, literal JSON, postfix program); null is identity."""
    if mapping is None:
        return None
    return [
        (key, "", compile_expression(value))
        if isinstance(value, str) and "$" in value
        else (key, json.dumps(value, allow_nan=False), [])
        for key, value in mapping.items()
    ]
