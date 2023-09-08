import structlog
from uuid import UUID

from polar.worker import JobContext, PolarWorkerContext, task
from polar.logging import Logger
from polar.postgres import AsyncSessionLocal
from polar.exceptions import PolarTaskError
from .service import magic_link as magic_link_service

log: Logger = structlog.get_logger()


class MagicLinkTaskError(PolarTaskError):
    ...


class MagicLinkNotFoundError(MagicLinkTaskError):
    def __init__(self, magic_link_id: UUID) -> None:
        self.magic_link_id = magic_link_id
        message = f"magic link with id {magic_link_id} not found"
        super().__init__(message)


@task("magic_link.request")
async def magic_link_request(
    ctx: JobContext, magic_link_id: UUID, token: str, polar_context: PolarWorkerContext
) -> None:
    with polar_context.to_execution_context():
        async with AsyncSessionLocal() as session:
            magic_link = await magic_link_service.get(session, magic_link_id)

            if magic_link is None:
                raise MagicLinkNotFoundError(magic_link_id)

            # SEND EMAIL
