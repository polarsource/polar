import structlog
from fastapi import APIRouter, Depends

from polar.auth.dependencies import Auth
from polar.exceptions import Unauthorized
from polar.postgres import AsyncSession, get_db_session
from polar.tags.api import Tags
from polar.types import ListResource, Pagination

from .schemas import (
    PaymentMethod,
)
from .service import service

log = structlog.get_logger()

router = APIRouter(tags=["payment_methods"])


@router.get(
    "/payment_methods",
    response_model=ListResource[PaymentMethod],
    tags=[Tags.INTERNAL],
    status_code=200,
)
async def list(
    auth: Auth = Depends(Auth.current_user),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[PaymentMethod]:
    if not auth.user:
        raise Unauthorized()

    orgs = await service.list_for_user(session, auth.user.id)
    return ListResource(
        items=[PaymentMethod.from_db(o) for o in orgs],
        pagination=Pagination(total_count=len(orgs)),
    )
