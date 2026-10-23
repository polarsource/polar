from fastapi import Depends

from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from .dependencies import agent_sign_up_enabled
from .schemas import AgentIdentity, AgentIdentityCreate
from .service import agent as agent_service

router = APIRouter(
    prefix="/agent",
    tags=["agent"],
    dependencies=[Depends(agent_sign_up_enabled)],
    include_in_schema=False,
)


@router.post("/identity", response_model=AgentIdentity)
async def create_identity(
    identity_create: AgentIdentityCreate,
    session: AsyncSession = Depends(get_db_session),
) -> AgentIdentity:
    """Sign up an agent, without a human (auth.md anonymous registration)."""
    return await agent_service.create_anonymous(session, identity_create)
