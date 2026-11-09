from fastapi import Depends, Request, Response
from fastapi.responses import PlainTextResponse

from polar.auth.exceptions import SessionNotFreshError
from polar.authz.dependencies import AuthorizeWebUserRead, AuthorizeWebUserWriteFresh
from polar.config import settings
from polar.exceptions import ResourceNotFound
from polar.oauth2.constants import CLAIM_POLL_INTERVAL
from polar.openapi import APITag
from polar.postgres import (
    AsyncReadSession,
    AsyncSession,
    get_db_read_session,
    get_db_session,
)
from polar.routing import APIRouter

from .auth_md import render_auth_md
from .schemas import (
    AgentClaim,
    AgentClaimCeremony,
    AgentClaimConfirm,
    AgentClaimPreview,
    AgentClaimStart,
    AgentClaimStarted,
    AgentIdentity,
    AgentIdentityCreate,
)
from .service import (
    CLAIM_TTL,
    AgentClaimEmailMismatch,
    AgentClaimExpired,
    AgentClaimInvalidCode,
)
from .service import agent as agent_service

router = APIRouter(prefix="/agent", tags=["agent"])


@router.post(
    "/identity",
    response_model=AgentIdentity,
    name="agent:create_identity",
    include_in_schema=False,
)
async def create_identity(
    identity_create: AgentIdentityCreate,
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> AgentIdentity:
    """Sign up an agent, without a human (auth.md anonymous registration)."""
    return await agent_service.create_anonymous(
        session, identity_create, claim_url=str(request.url_for("agent:start_claim"))
    )


@router.post(
    "/identity/claim",
    response_model=AgentClaimStarted,
    name="agent:start_claim",
    include_in_schema=False,
)
async def start_claim(
    claim_start: AgentClaimStart, session: AsyncSession = Depends(get_db_session)
) -> AgentClaimStarted:
    """Start a claim: a link and a code for the human (auth.md claim ceremony)."""
    attempt = await agent_service.start_claim(session, claim_start)
    return AgentClaimStarted(
        registration_id=attempt.agent.id,
        claim_attempt_id=attempt.id,
        status="initiated",
        expires_at=attempt.expires_at,
        claim_attempt=AgentClaimCeremony(
            user_code=attempt.code,
            expires_in=int(CLAIM_TTL.total_seconds()),
            verification_uri=settings.generate_frontend_url(
                f"/agent/claim?token={attempt.link_token}"
            ),
            interval=CLAIM_POLL_INTERVAL,
        ),
    )


@router.get(
    "/claim/{link_token}/preview",
    summary="Preview Agent Claim",
    response_model=AgentClaimPreview,
    tags=[APITag.private],
    responses={
        404: {"model": ResourceNotFound.schema()},
        410: {"model": AgentClaimExpired.schema()},
    },
)
async def preview_claim(
    link_token: str,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> AgentClaimPreview:
    """What a claim is about, shown to the human before they sign in."""
    return await agent_service.preview_claim(session, link_token)


@router.get(
    "/claim/{link_token}",
    summary="Get Agent Claim",
    response_model=AgentClaim,
    tags=[APITag.private],
    responses={
        403: {"model": AgentClaimEmailMismatch.schema()},
        404: {"model": ResourceNotFound.schema()},
        410: {"model": AgentClaimExpired.schema()},
    },
)
async def get_claim(
    link_token: str,
    auth_subject: AuthorizeWebUserRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> AgentClaim:
    """Get what an agent built, for the human it asked to claim it."""
    return await agent_service.get_claim(session, auth_subject.subject, link_token)


@router.post(
    "/claim",
    summary="Confirm Agent Claim",
    status_code=204,
    tags=[APITag.private],
    responses={
        204: {"description": "The agent and its organization are now the user's."},
        400: {"model": AgentClaimInvalidCode.schema()},
        403: {
            "model": SessionNotFreshError.schema() | AgentClaimEmailMismatch.schema()
        },
        404: {"model": ResourceNotFound.schema()},
        410: {"model": AgentClaimExpired.schema()},
    },
)
async def confirm_claim(
    claim_confirm: AgentClaimConfirm,
    auth_subject: AuthorizeWebUserWriteFresh,
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    """Claim an agent and its organization with the code the agent gave."""
    await agent_service.confirm_claim(session, auth_subject.subject, claim_confirm)
    return Response(status_code=204)


auth_md_router = APIRouter(include_in_schema=False)


@auth_md_router.get("/auth.md", name="agent:auth_md")
async def auth_md(request: Request) -> PlainTextResponse:
    """How an agent signs up and gets claimed, in plain language (auth.md)."""
    return PlainTextResponse(
        render_auth_md(lambda name: str(request.url_for(name))),
        media_type="text/markdown; charset=utf-8",
    )
