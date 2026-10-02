from collections.abc import Iterable, Sequence
from dataclasses import dataclass

from fastapi.routing import APIRoute, RouteContext, iter_route_contexts
from starlette.routing import BaseRoute

from polar.kit.versioning import APIVersion, VersionedAPIRoute
from polar.openapi import APITag

MAX_CHOICE_OPTIONS = 255


@dataclass(frozen=True)
class CatalogEntry:
    operation_id: str
    method: str
    path: str
    summary: str
    description: str
    cli_command: str | None

    @property
    def criteria(self) -> str:
        text = f"{self.method} {self.path} — {self.summary}."
        return f"{text} {self.description}" if self.description else text


def _first_paragraph(text: str | None) -> str:
    if not text:
        return ""
    paragraph = text.strip().split("\n\n", 1)[0]
    return " ".join(line.strip() for line in paragraph.splitlines())


def _cli_command(operation_id: str, tags: Sequence[str]) -> str | None:
    if APITag.cli not in tags or APITag.private in tags:
        return None
    return "polar " + " ".join(operation_id.split(":"))


def _entries(context: RouteContext) -> Iterable[CatalogEntry]:
    operation_id: str = context.operation_id or context.unique_id
    path: str = context.path or ""
    for method in sorted(context.methods or ()):
        yield CatalogEntry(
            operation_id=operation_id,
            method=method,
            path=path,
            summary=context.summary or operation_id,
            description=_first_paragraph(context.description),
            cli_command=_cli_command(operation_id, context.tags),
        )


def _is_public(context: RouteContext, version: APIVersion) -> bool:
    route = context.original_route
    if not isinstance(route, APIRoute) or not context.include_in_schema:
        return False
    tags: Sequence[str] = context.tags
    if APITag.public not in tags or APITag.private in tags:
        return False
    if isinstance(route, VersionedAPIRoute):
        return route.is_available_in(version)
    return True


_cache: dict[str, Sequence[CatalogEntry]] = {}


def build_catalog(
    routes: Sequence[BaseRoute], version: APIVersion
) -> Sequence[CatalogEntry]:
    key = str(version)
    if key not in _cache:
        entries = [
            entry
            for context in iter_route_contexts(routes)
            if _is_public(context, version)
            for entry in _entries(context)
        ]
        if len(entries) >= MAX_CHOICE_OPTIONS:
            raise ValueError(
                f"{len(entries)} public operations exceed the "
                f"{MAX_CHOICE_OPTIONS - 1} Jev can rank in one question"
            )
        _cache[key] = entries
    return _cache[key]
