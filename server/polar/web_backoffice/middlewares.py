from starlette.types import ASGIApp, Receive, Scope, Send
from tagflow import document


class TagflowMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            return await self.app(scope, receive, send)

        with document():
            await self.app(scope, receive, send)
