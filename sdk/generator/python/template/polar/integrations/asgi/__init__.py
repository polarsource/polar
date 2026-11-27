import collections.abc
import functools
import importlib
import os
import typing

from asgiref.typing import (
    ASGI3Application,
    ASGIReceiveCallable,
    ASGISendCallable,
    ASGISendEvent,
    LifespanScope,
    Scope,
)

from polar.base import PolarAsyncBase
from polar.logging import get_logger

log = get_logger(__name__)

_P = typing.ParamSpec("_P")


class PolarMiddleware(typing.Generic[_P]):
    """Share an async Polar client through `scope["state"]["polar"]`."""

    def __init__(
        self,
        app: ASGI3Application,
        client_class: collections.abc.Callable[_P, PolarAsyncBase],
        *args: _P.args,
        **kwargs: _P.kwargs,
    ) -> None:
        self.app = app
        self._open_client = functools.partial(client_class, *args, **kwargs)

    async def __call__(
        self, scope: Scope, receive: ASGIReceiveCallable, send: ASGISendCallable
    ) -> None:
        if scope["type"] == "lifespan":
            await self._lifespan(scope, receive, send)
            return

        try:
            await self.app(scope, receive, send)
        finally:
            if scope["type"] == "http" and os.environ.get("VERCEL") == "1":
                polar = (scope.get("state") or {}).get("polar")
                if polar is not None and polar._event_queue is not None:
                    await self._flush_after_request(polar)

    async def _lifespan(
        self, scope: LifespanScope, receive: ASGIReceiveCallable, send: ASGISendCallable
    ) -> None:
        state = scope.get("state")
        if state is None:
            raise RuntimeError("PolarMiddleware requires ASGI lifespan state")

        opened = False
        shutdown_complete = False

        async def send_lifespan(message: ASGISendEvent) -> None:
            nonlocal shutdown_complete
            if message["type"] == "lifespan.shutdown.complete":
                # Acknowledge shutdown after the client drains and closes.
                shutdown_complete = True
            else:
                await send(message)

        try:
            async with self._open_client() as polar:
                opened = True
                state["polar"] = polar
                try:
                    await self.app(scope, receive, send_lifespan)
                finally:
                    state.pop("polar", None)
        except Exception as error:
            if not opened:
                await send({"type": "lifespan.startup.failed", "message": str(error)})
            elif shutdown_complete:
                await send({"type": "lifespan.shutdown.failed", "message": str(error)})
            raise

        if shutdown_complete:
            await send({"type": "lifespan.shutdown.complete"})

    async def _flush_after_request(self, polar: PolarAsyncBase) -> None:
        try:
            wait_until = importlib.import_module("vercel.functions").wait_until
        except (ImportError, AttributeError):
            log.warning(
                "Vercel wait_until is unavailable. Awaiting the Polar event flush before returning."
            )
            try:
                await polar.flush()
            except Exception:
                log.exception("Failed to flush Polar events")
        else:
            wait_until(polar.flush())


__all__ = ["PolarMiddleware"]
