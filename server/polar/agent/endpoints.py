from fastapi import Depends

from polar.auth.scope import UNCLAIMED_AGENT_SCOPES
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
    sign_up = await agent_service.create_anonymous(session, identity_create)
    return AgentIdentity(
        registration_id=sign_up.agent.id,
        registration_type="anonymous",
        identity_assertion=sign_up.identity_assertion.token,
        assertion_expires=sign_up.identity_assertion.expires_at,
        pre_claim_scopes=sorted(UNCLAIMED_AGENT_SCOPES),
        claim_token=sign_up.claim_token,
        claim_token_expires=sign_up.claim_token_expires_at,
    )
