import typing

from fastapi import Depends, Request

from polar.base import PolarAsyncBase
from polar.integrations.asgi import PolarMiddleware


async def _get_polar(request: Request) -> PolarAsyncBase:
    """
    Get the Polar client from the request state.

    Args:
        request: The FastAPI request object.

    Returns:
        The Polar client instance.

    Raises:
        RuntimeError: If the Polar client is not found in the request state.
    """
    try:
        return request.state.polar
    except AttributeError as e:
        raise RuntimeError(
            "Polar client not found. Did you forget to add PolarMiddleware to your FastAPI app?"
        ) from e


_P = typing.TypeVar("_P", bound=PolarAsyncBase)


PolarDependency: typing.TypeAlias = typing.Annotated[_P, Depends(_get_polar)]
"""
Create a type alias for a Polar client dependency in FastAPI.

Example::

    from polar.v2026_04 import PolarAsync
    from polar.integrations.fastapi import PolarDependency

    Polar = PolarDependency[PolarAsync]

    @app.get("/some-endpoint")
    async def some_endpoint(polar: Polar):
        ...
"""


__all__ = ["PolarDependency", "PolarMiddleware"]
