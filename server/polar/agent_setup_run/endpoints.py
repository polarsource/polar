from fastapi import Depends

from polar.authz.dependencies import AuthorizeOrgManageUser, AuthorizeOrgManageUserRead
from polar.exceptions import ResourceNotFound
from polar.models import AgentSetupRun
from polar.openapi import APITag
from polar.postgres import (
    AsyncReadSession,
    AsyncSession,
    get_db_read_session,
    get_db_session,
)
from polar.routing import APIRouter

from .schemas import (
    AgentSetupDrafts,
    AgentSetupReport,
    AgentSetupRunCreated,
    AgentSetupRunState,
)
from .schemas import AgentSetupRun as AgentSetupRunSchema
from .service import agent_setup_run as agent_setup_run_service

router = APIRouter(
    prefix="/agent-setup-runs", tags=["agent_setup_runs", APITag.private]
)


@router.post(
    "/organization/{id}",
    summary="Create Agent Setup Run",
    response_model=AgentSetupRunCreated,
    status_code=201,
    responses={404: {"model": ResourceNotFound.schema()}},
)
async def create(
    authz: AuthorizeOrgManageUser,
    session: AsyncSession = Depends(get_db_session),
) -> AgentSetupRunCreated:
    """Start a setup run and get the code a coding agent reports its progress with."""
    run, code = await agent_setup_run_service.create(session, authz.organization)
    return AgentSetupRunCreated.model_validate(
        {**AgentSetupRunSchema.model_validate(run).model_dump(), "code": code}
    )


@router.get(
    "/organization/{id}",
    summary="Get Latest Agent Setup Run",
    response_model=AgentSetupRunSchema,
    responses={404: {"model": ResourceNotFound.schema()}},
)
async def get_latest(
    authz: AuthorizeOrgManageUserRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> AgentSetupRun:
    """Get the latest setup run of an organization."""
    return await agent_setup_run_service.get_latest(session, authz.organization)


@router.post(
    "/organization/{id}/approve",
    summary="Approve Agent Setup Drafts",
    response_model=AgentSetupRunSchema,
    responses={404: {"model": ResourceNotFound.schema()}},
)
async def approve(
    drafts: AgentSetupDrafts,
    authz: AuthorizeOrgManageUser,
    session: AsyncSession = Depends(get_db_session),
) -> AgentSetupRun:
    """Approve what the agent drafted, with the user's edits."""
    return await agent_setup_run_service.approve(session, authz.organization, drafts)


@router.post(
    "/report",
    summary="Report Agent Setup Progress",
    response_model=AgentSetupRunState,
    responses={404: {"model": ResourceNotFound.schema()}},
)
async def report(
    setup_report: AgentSetupReport,
    session: AsyncSession = Depends(get_db_session),
) -> AgentSetupRun:
    """Report a stage or drafts with the run code, and read what the user approved."""
    return await agent_setup_run_service.report(session, setup_report)
