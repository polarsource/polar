from arq.worker import async_check_health
from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import Response
from starlette.routing import Route

from polar.logging import configure as configure_logging
from polar.worker import WorkerSettings

configure_logging()


async def healthz(request: Request) -> Response:
    exit_code = await async_check_health(WorkerSettings.redis_settings)
    if exit_code == 0:
        return Response(status_code=200)
    else:
        return Response(status_code=503)


app = Starlette(routes=[Route("/healthz", endpoint=healthz)])
