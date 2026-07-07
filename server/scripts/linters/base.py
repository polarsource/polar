from __future__ import annotations

import ast
import re
from collections.abc import Callable
from dataclasses import dataclass

Violation = tuple[int, str]


@dataclass(frozen=True)
class Rule:
    name: str
    noqa_code: str
    summary: str
    check: Callable[[ast.Module], list[Violation]]


_NOQA_RE = re.compile(r"#\s*noqa(?::\s*(?P<codes>[^#]*))?", re.IGNORECASE)


def line_has_noqa(source_lines: list[str], lineno: int, noqa_code: str) -> bool:
    idx = lineno - 1
    if not (0 <= idx < len(source_lines)):
        return False
    match = _NOQA_RE.search(source_lines[idx])
    if match is None:
        return False
    codes = match.group("codes")
    if codes is None:
        return True
    return noqa_code in {code.strip() for code in codes.split(",")}
