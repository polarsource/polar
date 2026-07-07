from __future__ import annotations

import ast
import re
from collections.abc import Callable
from dataclasses import dataclass

Violation = tuple[int, str]


@dataclass(frozen=True)
class Rule:
    name: str
    skip_code: str
    summary: str
    check: Callable[[ast.Module], list[Violation]]


_SKIP_RE = re.compile(r"#\s*lint-skip(?::\s*(?P<codes>[^#]*))?")


def line_has_skip(source_lines: list[str], lineno: int, skip_code: str) -> bool:
    idx = lineno - 1
    if not (0 <= idx < len(source_lines)):
        return False
    match = _SKIP_RE.search(source_lines[idx])
    if match is None:
        return False
    codes = match.group("codes")
    if codes is None:
        return True
    return skip_code in {code.strip() for code in codes.split(",")}
