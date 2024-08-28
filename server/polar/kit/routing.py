import functools
import inspect
from collections.abc import Callable
from typing import Any, ParamSpec, TypeVar

from fastapi import APIRouter as _APIRouter
from fastapi.routing import APIRoute

from polar.kit.pagination import ListResource
from polar.openapi import APITag

from .db.postgres import AsyncSession


class AutoCommitAPIRoute(APIRoute):
    """
    A subclass of `APIRoute` that automatically
    commits the session after the endpoint is called.

    It allows to directly return ORM objects from the endpoint
    without having to call `session.commit()` before returning.
    """

    def __init__(self, path: str, endpoint: Callable[..., Any], **kwargs: Any) -> None:
        endpoint = self.wrap_endpoint(endpoint)
        super().__init__(path, endpoint, **kwargs)

    def wrap_endpoint(self, endpoint: Callable[..., Any]) -> Callable[..., Any]:
        @functools.wraps(endpoint)
        async def wrapped_endpoint(*args: Any, **kwargs: Any) -> Any:
            session: AsyncSession | None = None
            for arg in (args, *kwargs.values()):
                if isinstance(arg, AsyncSession):
                    session = arg
                    break

            response = await endpoint(*args, **kwargs)

            if session is not None:
                await session.commit()

            return response

        return wrapped_endpoint


class SpeakeasyNameOverrideAPIRoute(APIRoute):
    """
    A subclass of `APIRoute` that automatically adds `x-speakeasy-name-override` property
    following the route function name.
    """

    def __init__(self, path: str, endpoint: Callable[..., Any], **kwargs: Any) -> None:
        super().__init__(path, endpoint, **kwargs)
        endpoint_name = endpoint.__name__
        if endpoint_name == "get":
            endpoint_name = "retrieve"
        openapi_extra = self.openapi_extra or {}
        if "x-speakeasy-name-override" not in openapi_extra:
            self.openapi_extra = {
                **openapi_extra,
                "x-speakeasy-name-override": endpoint_name,
            }


class SpeakeasyIgnoreAPIRoute(APIRoute):
    """
    A subclass of `APIRoute` that automatically adds `x-speakeasy-ignore` property
    to the OpenAPI schema if `APITag.documented` is missing.
    """

    def __init__(self, path: str, endpoint: Callable[..., Any], **kwargs: Any) -> None:
        super().__init__(path, endpoint, **kwargs)
        tags = self.tags
        if APITag.documented not in tags:
            openapi_extra = self.openapi_extra or {}
            self.openapi_extra = {**openapi_extra, "x-speakeasy-ignore": True}


class SpeakeasyGroupAPIRoute(APIRoute):
    """
    A subclass of `APIRoute` that automatically adds `x-speakeasy-group` property
    to the OpenAPI schema by combining all the non-generic tags.
    """

    def __init__(self, path: str, endpoint: Callable[..., Any], **kwargs: Any) -> None:
        super().__init__(path, endpoint, **kwargs)
        non_generic_tags = [str(tag) for tag in self.tags if tag not in APITag]
        if len(non_generic_tags) > 0:
            openapi_extra = self.openapi_extra or {}
            self.openapi_extra = {
                **openapi_extra,
                "x-speakeasy-group": ".".join(non_generic_tags),
            }


class SpeakeasyPaginationAPIRoute(APIRoute):
    """
    A subclass of `APIRoute` that automatically adds `x-speakeasy-pagination` property
    to the OpenAPI schema if the endpoint response model is a `ListResource`.
    """

    def __init__(self, path: str, endpoint: Callable[..., Any], **kwargs: Any) -> None:
        super().__init__(path, endpoint, **kwargs)
        response_model = self.response_model
        if (
            response_model is not None
            and inspect.isclass(response_model)
            and ListResource in response_model.mro()
        ):
            openapi_extra = self.openapi_extra or {}
            self.openapi_extra = {
                **openapi_extra,
                "x-speakeasy-pagination": {
                    "type": "offsetLimit",
                    "inputs": [
                        {
                            "name": "page",
                            "in": "parameters",
                            "type": "page",
                        },
                        {
                            "name": "limit",
                            "in": "parameters",
                            "type": "limit",
                        },
                    ],
                    "outputs": {
                        "results": "$.items",
                        "numPages": "$.pagination.max_page",
                    },
                },
            }


_P = ParamSpec("_P")
_T = TypeVar("_T")


def _inherit_signature_from(
    _to: Callable[_P, _T],
) -> Callable[[Callable[..., _T]], Callable[_P, _T]]:
    return lambda x: x  # pyright: ignore


def get_api_router_class(route_class: type[APIRoute]) -> type[_APIRouter]:
    """
    Returns a subclass of `APIRouter` that uses the given `route_class`.
    """

    class _CustomAPIRouter(_APIRouter):
        @_inherit_signature_from(_APIRouter.__init__)
        def __init__(self, *args: Any, **kwargs: Any) -> None:
            kwargs["route_class"] = route_class
            super().__init__(*args, **kwargs)

    return _CustomAPIRouter


__all__ = ["get_api_router_class", "AutoCommitAPIRoute"]
