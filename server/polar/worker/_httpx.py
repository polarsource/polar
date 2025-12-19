import dramatiq
import httpx
import structlog
from dramatiq.asyncio import get_event_loop_thread

from polar.logging import Logger

log: Logger = structlog.get_logger()


_httpx: httpx.AsyncClient | None = None


async def _close_client() -> None:
    global _httpx
    if _httpx is not None:
        await _httpx.aclose()
        log.info("Closed HTTPX client")
        _httpx = None


class HTTPXMiddleware(dramatiq.Middleware):
    """
    Middleware managing the lifecycle of an HTTPX AsyncClient.
    """

    @classmethod
    def get(cls) -> httpx.AsyncClient:
        global _httpx
        if _httpx is None:
            raise RuntimeError("HTTPX not initialized")
        return _httpx

    def before_worker_boot(
        self, broker: dramatiq.Broker, worker: dramatiq.Worker
    ) -> None:
        global _httpx
        _httpx = httpx.AsyncClient()
        log.info("Created HTTPX client")

    def after_worker_shutdown(
        self, broker: dramatiq.Broker, worker: dramatiq.Worker
    ) -> None:
        event_loop_thread = get_event_loop_thread()
        assert event_loop_thread is not None
        event_loop_thread.run_coroutine(_close_client())
