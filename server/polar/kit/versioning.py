import contextlib
import contextvars
import dataclasses
import functools
import re
import typing
from collections.abc import (
    Awaitable,
    Callable,
    Generator,
    Iterable,
    Sequence,
)

from fastapi import APIRouter, FastAPI
from fastapi.routing import APIRoute
from pydantic import Field, GetJsonSchemaHandler
from pydantic.fields import FieldInfo
from pydantic.json_schema import JsonSchemaValue
from pydantic_core import CoreSchema, PydanticOmit
from starlette.datastructures import Headers, MutableHeaders
from starlette.responses import JSONResponse
from starlette.routing import BaseRoute, Match
from starlette.types import ASGIApp, Message, Receive, Scope, Send
from starlette.websockets import WebSocketClose

_API_VERSION_PATTERN = re.compile(r"^(\d{4})-(\d{2})$")


@dataclasses.dataclass(frozen=True, order=True, slots=True)
class APIVersion:
    """
    Represents an API version in the format "YYYY-MM".
    """

    year: int
    month: int

    def __str__(self) -> str:
        return f"{self.year}-{self.month:02d}"

    @classmethod
    def parse(cls, version_str: str) -> typing.Self:
        match = re.fullmatch(_API_VERSION_PATTERN, version_str)
        if not match:
            raise ValueError(f"Invalid version string: {version_str}")
        year_str, month_str = match.groups()
        return cls(year=int(year_str), month=int(month_str))

    @typing.overload
    @classmethod
    def from_scope(cls, scope: Scope) -> typing.Self | None: ...

    @typing.overload
    @classmethod
    def from_scope(cls, scope: Scope, default: typing.Self) -> typing.Self: ...

    @classmethod
    def from_scope(
        cls, scope: Scope, default: typing.Self | None = None
    ) -> typing.Self | None:
        headers = Headers(scope=scope)
        raw_version = headers.get(VERSION_HEADER)
        return cls.parse(raw_version) if raw_version else default


_ACTIVE_API_VERSION = contextvars.ContextVar[APIVersion | None](
    "active_api_version", default=None
)


@contextlib.contextmanager
def api_version_context(version: APIVersion) -> Generator[None]:
    token = _ACTIVE_API_VERSION.set(version)
    try:
        yield
    finally:
        _ACTIVE_API_VERSION.reset(token)


@dataclasses.dataclass(frozen=True, slots=True)
class _VersionAvailability:
    versions: frozenset[APIVersion]
    include_matches: bool

    def is_available(self, version: APIVersion) -> bool:
        return (version in self.versions) is self.include_matches

    def __get_pydantic_json_schema__(
        self, core_schema: CoreSchema, handler: GetJsonSchemaHandler
    ) -> JsonSchemaValue:
        version = _ACTIVE_API_VERSION.get()
        if version is not None and not self.is_available(version):
            raise PydanticOmit
        return handler(core_schema)


def _versioned_field(
    versions: tuple[APIVersion, ...], *, include_matches: bool
) -> FieldInfo:
    if not versions:
        raise ValueError("At least one API version is required")

    availability = _VersionAvailability(frozenset(versions), include_matches)

    def exclude_if_unavailable(_: typing.Any) -> bool:
        version = _ACTIVE_API_VERSION.get()
        return version is not None and not availability.is_available(version)

    field_info = Field(exclude_if=exclude_if_unavailable)
    field_info.metadata.append(availability)
    return field_info


def IncludedIn(*versions: APIVersion) -> FieldInfo:
    return _versioned_field(versions, include_matches=True)


def ExcludedIn(*versions: APIVersion) -> FieldInfo:
    return _versioned_field(versions, include_matches=False)


def version[**P, R](
    *versions: APIVersion,
) -> Callable[[Callable[P, R]], Callable[P, R]]:
    """
    Decorator to specify the API versions supported by an endpoint.
    """
    if not versions:
        raise ValueError("At least one API version is required")

    def decorator(endpoint: Callable[P, R]) -> Callable[P, R]:
        setattr(endpoint, "_api_versions", frozenset(versions))
        return endpoint

    return decorator


VERSION_HEADER = "Polar-Version"


class APIVersionMiddleware:
    def __init__(
        self,
        app: ASGIApp,
        versions: Iterable[APIVersion],
        default_version: APIVersion,
    ) -> None:
        self.app = app
        self.versions = frozenset(versions)
        self.default_version = default_version
        if default_version not in self.versions:
            raise ValueError(f"Default API version {default_version} is not supported")

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] not in ("http", "websocket"):
            await self.app(scope, receive, send)
            return

        try:
            api_version = APIVersion.from_scope(scope, default=self.default_version)
        except ValueError:
            api_version = None

        if api_version not in self.versions:
            if scope["type"] == "http":
                await JSONResponse({"detail": "Not Found"}, status_code=404)(
                    scope, receive, send
                )
            else:
                await WebSocketClose()(scope, receive, send)
            return

        scope.setdefault("state", {})["api_version"] = api_version

        async def send_wrapper(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                headers[VERSION_HEADER] = str(api_version)
            await send(message)

        with api_version_context(api_version):
            await self.app(scope, receive, send_wrapper)


class VersionedAPIRoute(APIRoute):
    api_versions: frozenset[APIVersion] | None
    overridden_versions: frozenset[APIVersion]

    def __init__(
        self, path: str, endpoint: Callable[..., typing.Any], **kwargs: typing.Any
    ) -> None:
        self.api_versions = getattr(endpoint, "_api_versions", None)
        self.overridden_versions = frozenset()
        super().__init__(path, endpoint, **kwargs)

    def is_available_in(self, version: APIVersion) -> bool:
        if self.api_versions is not None:
            return version in self.api_versions
        return version not in self.overridden_versions

    def matches(self, scope: Scope) -> tuple[Match, Scope]:
        match, child_scope = super().matches(scope)
        if match is Match.NONE:
            return match, child_scope

        api_version: APIVersion = scope["state"]["api_version"]
        if not self.is_available_in(api_version):
            return Match.NONE, {}

        return match, child_scope


type _RouteKey = tuple[str, frozenset[str]]


def _get_route_key(route: APIRoute) -> _RouteKey:
    return route.path, frozenset(route.methods or ())


def finalize_versioned_routes(
    routes: Iterable[BaseRoute], versions: Iterable[APIVersion]
) -> None:
    supported_versions = frozenset(versions)
    route_versions_map: dict[_RouteKey, list[VersionedAPIRoute]] = {}

    for route in routes:
        if isinstance(route, VersionedAPIRoute):
            route_versions_map.setdefault(_get_route_key(route), []).append(route)

    for route_key, route_versions in route_versions_map.items():
        versioned_routes = [
            route for route in route_versions if route.api_versions is not None
        ]
        if not versioned_routes:
            continue

        general_routes = [
            route for route in route_versions if route.api_versions is None
        ]
        if len(general_routes) > 1:
            path, methods = route_key
            route_names = ", ".join(route.name for route in general_routes)
            raise ValueError(
                f"Multiple general routes match {'/'.join(sorted(methods))} {path}: "
                f"{route_names}"
            )

        routes_by_version: dict[APIVersion, VersionedAPIRoute] = {}
        for route in versioned_routes:
            assert route.api_versions is not None
            unsupported_versions = route.api_versions - supported_versions
            if unsupported_versions:
                raise ValueError(
                    f"Route {route.name} targets unsupported API versions: "
                    f"{', '.join(map(str, sorted(unsupported_versions)))}"
                )
            for api_version in route.api_versions:
                conflicting_route = routes_by_version.get(api_version)
                if conflicting_route is not None:
                    path, methods = route_key
                    raise ValueError(
                        f"Multiple routes match API version {api_version} for "
                        f"{'/'.join(sorted(methods))} {path}: "
                        f"{conflicting_route.name}, {route.name}"
                    )
                routes_by_version[api_version] = route

        overridden_versions = frozenset(routes_by_version)
        for route in general_routes:
            route.overridden_versions = overridden_versions


def routes_for_version(
    routes: Iterable[BaseRoute], version: APIVersion
) -> list[BaseRoute]:
    return [
        route
        for route in routes
        if not isinstance(route, VersionedAPIRoute) or route.is_available_in(version)
    ]


def _create_openapi_endpoint(
    version: APIVersion,
    routes: Sequence[BaseRoute],
    webhooks: Sequence[BaseRoute],
) -> Callable[[], Awaitable[JSONResponse]]:
    @functools.cache
    def get_schema() -> dict[str, typing.Any]:
        from polar.openapi import get_openapi

        return get_openapi(version=version, routes=routes, webhooks=webhooks)

    async def openapi() -> JSONResponse:
        return JSONResponse(get_schema())

    return openapi


def add_versioned_routers(
    app: FastAPI,
    api_router: APIRouter,
    webhooks: Sequence[BaseRoute],
    versions: Iterable[APIVersion],
    default_version: APIVersion,
) -> None:
    supported_versions = tuple(sorted(set(versions)))
    if default_version not in supported_versions:
        raise ValueError(f"Default API version {default_version} is not supported")
    app.add_middleware(
        APIVersionMiddleware,
        versions=supported_versions,
        default_version=default_version,
    )

    first_route_index = len(app.router.routes)
    app.include_router(api_router)
    api_routes = app.router.routes[first_route_index:]
    finalize_versioned_routes(api_routes, supported_versions)

    for version in supported_versions:
        version_routes = routes_for_version(api_routes, version)
        app.add_api_route(
            f"/{version}/openapi.json",
            _create_openapi_endpoint(version, version_routes, webhooks),
            methods=["GET"],
            include_in_schema=False,
            name=f"openapi:{version}",
        )
