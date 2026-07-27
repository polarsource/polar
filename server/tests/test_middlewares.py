import asyncio
import json
from typing import Any, cast

from starlette.types import Message, Receive, Scope, Send

from polar.middlewares import MaxBodySizeMiddleware


def _http_scope(headers: list[tuple[bytes, bytes]], method: str = "POST") -> Scope:
    return cast(
        Scope,
        {
            "type": "http",
            "method": method,
            "path": "/v1/files/",
            "headers": headers,
        },
    )


def _run(
    limit: int,
    headers: list[tuple[bytes, bytes]],
    body_chunks: list[bytes],
    method: str = "POST",
) -> tuple[list[Message], bool]:
    app_called = False

    async def reading_app(scope: Scope, receive: Receive, send: Send) -> None:
        nonlocal app_called
        app_called = True
        more_body = True
        while more_body:
            message = await receive()
            more_body = message.get("more_body", False)
        await send({"type": "http.response.start", "status": 200, "headers": []})
        await send({"type": "http.response.body", "body": b"ok"})

    middleware = MaxBodySizeMiddleware(reading_app, limit=limit)

    messages = [
        {
            "type": "http.request",
            "body": chunk,
            "more_body": i < len(body_chunks) - 1,
        }
        for i, chunk in enumerate(body_chunks)
    ]
    messages_iter = iter(messages)

    async def receive() -> Message:
        return cast(Message, next(messages_iter))

    sent: list[Message] = []

    async def send(message: Message) -> None:
        sent.append(message)

    asyncio.run(middleware(_http_scope(headers, method), receive, cast(Send, send)))
    return sent, app_called


def _response_status(sent: list[Message]) -> int:
    return next(m["status"] for m in sent if m["type"] == "http.response.start")


def _response_json(sent: list[Message]) -> dict[str, Any]:
    body = b"".join(
        m.get("body", b"") for m in sent if m["type"] == "http.response.body"
    )
    return json.loads(body)


class TestMaxBodySizeMiddleware:
    def test_under_limit(self) -> None:
        sent, app_called = _run(
            limit=10,
            headers=[(b"content-length", b"4")],
            body_chunks=[b"1234"],
        )
        assert app_called is True
        assert _response_status(sent) == 200

    def test_content_length_over_limit(self) -> None:
        sent, app_called = _run(
            limit=10,
            headers=[(b"content-length", b"11")],
            body_chunks=[b"12345678901"],
        )
        assert app_called is False
        assert _response_status(sent) == 413
        assert _response_json(sent)["error"] == "RequestBodyTooLarge"

    def test_missing_content_length_post(self) -> None:
        sent, app_called = _run(
            limit=10,
            headers=[],
            body_chunks=[b"1234"],
        )
        assert app_called is False
        assert _response_status(sent) == 411
        assert _response_json(sent)["error"] == "LengthRequired"

    def test_missing_content_length_get(self) -> None:
        sent, app_called = _run(
            limit=10,
            headers=[],
            body_chunks=[b""],
            method="GET",
        )
        assert app_called is True
        assert _response_status(sent) == 200
