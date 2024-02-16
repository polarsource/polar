import time

from prometheus_client import Counter, Histogram
from starlette.types import ASGIApp, Message, Receive, Scope, Send


class PrometheusHttpMiddleware:
    def __init__(
        self,
        app: ASGIApp,
    ) -> None:
        self.app = app

        self.request_latency_seconds = Histogram(
            "request_latency_seconds", "Request response time", ["method", "path"]
        )

        self.request_response_code = Counter(
            "request_response_code",
            "Request response codes",
            ["method", "path", "code"],
        )

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        t0 = time.process_time()

        status_code = 500

        async def send_wrapper(message: Message) -> None:
            if message["type"] == "http.response.start":
                nonlocal status_code
                status_code = message["status"]
            await send(message)

        await self.app(scope, receive, send_wrapper)

        duration = time.process_time() - t0

        self.request_latency_seconds.labels(
            method=scope["method"],
            path=scope["route"].path,
        ).observe(duration)

        self.request_response_code.labels(
            method=scope["method"],
            path=scope["route"].path,
            code=status_code,
        ).inc()
