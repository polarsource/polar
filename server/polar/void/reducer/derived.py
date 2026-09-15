"""Mergeable scalar input state for one layer of derived reducers."""

import math
from collections.abc import Callable, Iterable, Mapping
from functools import lru_cache
from typing import Protocol

from .aggregation import Aggregation
from .exceptions import InvalidReducer
from .map import compile_expression

MERGE: dict[str, Callable[[Iterable[float]], float]] = {
    "count": sum,
    "sum": sum,
    "min": min,
    "max": max,
}


class ReducerSource(Protocol):
    @property
    def aggregation(self) -> Aggregation: ...


def validate_inputs(
    inputs: Mapping[str, str], sources: Mapping[str, ReducerSource]
) -> None:
    for slug in inputs.values():
        source = sources.get(slug)
        if source is None:
            raise InvalidReducer(
                f"Input reducer {slug!r} does not exist in this organization"
            )
        if source.aggregation.func not in MERGE:
            raise InvalidReducer(
                f"Input reducer {slug!r} must be an event scalar reducer"
            )


def empty_state(functions: Mapping[str, str]) -> dict[str, float | None]:
    return {
        name: 0.0 if func in ("count", "sum") else None
        for name, func in functions.items()
    }


def merge_state(
    functions: Mapping[str, str], *states: Mapping[str, float | None]
) -> dict[str, float | None]:
    result = empty_state(functions)
    for name, func in functions.items():
        present = [value for state in states if (value := state.get(name)) is not None]
        if present:
            result[name] = MERGE[func](present)
    return result


@lru_cache(maxsize=256)
def _program(expression: str) -> tuple[tuple[str, str], ...]:
    return tuple(compile_expression(expression))


def evaluate(expression: str, inputs: Mapping[str, float | None]) -> float | None:
    stack: list[float | None] = []
    for op, arg in _program(expression):
        if op in ("ref", "number"):
            result = inputs.get(arg) if op == "ref" else float(arg)
        elif op in ("neg", "pos"):
            operand = stack.pop()
            if operand is None:
                result = None
            elif op == "neg":
                result = -operand
            else:
                result = operand
        else:
            right, left = stack.pop(), stack.pop()
            if left is None or right is None or (op == "/" and right == 0):
                result = None
            elif op == "+":
                result = left + right
            elif op == "-":
                result = left - right
            elif op == "*":
                result = left * right
            else:
                result = left / right
        stack.append(result if result is not None and math.isfinite(result) else None)
    return stack[0]
