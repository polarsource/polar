from fastapi import Depends

from polar.models import MemberSession
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from . import auth
from .schemas import MemberSession as MemberSessionSchema
from .schemas import MemberSessionCreate
from .service import member_session as member_session_service

router = APIRouter(
    prefix="/member-sessions",
    tags=["member-sessions", APITag.public],
)


@router.post(
    "/",
    response_model=MemberSessionSchema,
    status_code=201,
    summary="Create Member Session",
    responses={201: {"description": "Member session created."}},
)
async def create(
    member_session_create: MemberSessionCreate,
    auth_subject: auth.MemberSessionWrite,
    session: AsyncSession = Depends(get_db_session),
) -> MemberSession:
    """
    Create a member session.

    This endpoint is only available for organizations with `member_model_enabled`
    and `seat_based_pricing_enabled` feature flags enabled.
    """
    return await member_session_service.create(
        session, auth_subject, member_session_create
    )
