import structlog
from fastapi import Depends, Request
from sse_starlette.sse import EventSourceResponse

from polar.cli import auth
from polar.eventstream.endpoints import subscribe
from polar.eventstream.service import Receivers
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.redis import Redis, get_redis
from polar.routing import APIRouter

log = structlog.get_logger()


router = APIRouter(prefix="/cli", tags=["cli", APITag.private])


@router.get("/listen")
async def listen(
    request: Request,
    auth_subject: auth.CLIRead,
    redis: Redis = Depends(get_redis),
    session: AsyncSession = Depends(get_db_session),
) -> EventSourceResponse:
    receivers = Receivers(organization_id=auth_subject.subject.id)
    return EventSourceResponse(subscribe(redis, receivers.get_channels(), request))
