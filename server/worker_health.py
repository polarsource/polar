import structlog
from arq.worker import async_check_health
from starlette.applications import Starlette
from starlette.convertors import StringConvertor, register_url_convertor
from starlette.requests import Request
from starlette.responses import Response
from starlette.routing import Route

from polar.logging import Logger
from polar.logging import configure as configure_logging
from polar.worker import WorkerSettings, WorkerSettingsGitHubCrawl

configure_logging()
logger: Logger = structlog.get_logger()


async def arq_health_check(
    settings_cls: type[WorkerSettings] | type[WorkerSettingsGitHubCrawl],
) -> bool:
    exit_code = await async_check_health(settings_cls.redis_settings)
    return exit_code == 0


class WorkerParamConvertor(StringConvertor):
    regex = "main|github"


register_url_convertor("worker", WorkerParamConvertor())


async def healthz(request: Request) -> Response:
    worker = request.path_params["worker"]
    worker_class = WorkerSettingsGitHubCrawl if worker == "github" else WorkerSettings
    if await arq_health_check(worker_class):
        return Response(status_code=200)
    else:
        return Response(status_code=503)


app = Starlette(routes=[Route("/{worker:worker}/healthz", endpoint=healthz)])
