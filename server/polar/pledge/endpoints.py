from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Request

from polar.auth.dependencies import Auth
from polar.models import Pledge, Repository
from polar.exceptions import ResourceNotFound, NotPermitted
from polar.enums import Platforms
from polar.models.issue import Issue
from polar.models.organization import Organization
from polar.models.user import User
from polar.postgres import AsyncSession, get_db_session

from polar.integrations.stripe.service import stripe
from polar.organization.schemas import OrganizationRead
from polar.organization.service import organization as organization_service
from polar.repository.schemas import RepositoryRead
from polar.issue.schemas import IssueRead

from .schemas import (
    PledgeCreate,
    PledgeMutationResponse,
    PledgeUpdate,
    PledgeRead,
    PledgeState,
    PledgeResources,
)
from .service import pledge as pledge_service

router = APIRouter(tags=["pledges"])


async def get_pledge_or_404(
    session: AsyncSession,
    *,
    pledge_id: UUID,
    for_repository: Repository,
) -> Pledge:
    pledge = await pledge_service.get_with_loaded(session=session, pledge_id=pledge_id)

    if not pledge:
        raise HTTPException(
            status_code=404,
            detail="Pledge not found",
        )

    if pledge.repository_id != for_repository.id:
        raise HTTPException(
            status_code=403, detail="Pledge does not belong to this repository"
        )

    return pledge


@router.get(
    "/{platform}/{org_name}/{repo_name}/issues/{number}/pledge",
    response_model=PledgeResources,
)
async def get_pledge_with_resources(
    platform: Platforms,
    org_name: str,
    repo_name: str,
    number: int,
    pledge_id: UUID | None = None,
    # Mimic JSON-API's include query format
    include: str = "organization,repository,issue",
    session: AsyncSession = Depends(get_db_session),
) -> PledgeResources:
    try:
        includes = include.split(",")
        org, repo, issue = await organization_service.get_with_repo_and_issue(
            session,
            platform=platform,
            org_name=org_name,
            repo_name=repo_name,
            issue=number,
        )

        included_pledge = None
        if pledge_id:
            pledge = await get_pledge_or_404(
                session,
                pledge_id=pledge_id,
                for_repository=repo,
            )
            included_pledge = PledgeRead.from_db(pledge)

        included_org = None
        if "organization" in includes:
            included_org = OrganizationRead.from_orm(org)

        included_repo = None
        if "repository" in includes:
            included_repo = RepositoryRead.from_orm(repo)

        included_issue = None
        if "issue" in includes:
            included_issue = IssueRead.from_orm(issue)

        return PledgeResources(
            pledge=included_pledge,
            organization=included_org,
            repository=included_repo,
            issue=included_issue,
        )
    except ResourceNotFound:
        raise HTTPException(
            status_code=404,
            detail="Organization, repo and issue combination not found",
        )


@router.post(
    "/{platform}/{org_name}/{repo_name}/issues/{number}/pledges",
    response_model=PledgeMutationResponse,
)
async def create_pledge(
    platform: Platforms,
    org_name: str,
    repo_name: str,
    number: int,
    pledge: PledgeCreate,
    session: AsyncSession = Depends(get_db_session),
    auth: Auth = Depends(Auth.optional_user),
) -> PledgeMutationResponse:
    org, repo, issue = await organization_service.get_with_repo_and_issue(
        session=session,
        platform=platform,
        org_name=org_name,
        repo_name=repo_name,
        issue=number,
    )

    try:
        return await pledge_service.create_pledge(
            platform=platform,
            user=auth.user,
            org=org,
            repo=repo,
            issue=issue,
            pledge=pledge,
            session=session,
        )
    except ResourceNotFound as e:
        raise HTTPException(
            status_code=404,
            detail=str(e),
        )
    except NotPermitted as e:
        raise HTTPException(
            status_code=403,
            detail=str(e),
        )


@router.patch(
    "/{platform}/{org_name}/{repo_name}/issues/{number}/pledges/{pledge_id}",
    response_model=PledgeMutationResponse,
)
async def update_pledge(
    platform: Platforms,
    org_name: str,
    repo_name: str,
    number: int,
    pledge_id: UUID,
    updates: PledgeUpdate,
    session: AsyncSession = Depends(get_db_session),
) -> PledgeMutationResponse:
    org, repo, issue = await organization_service.get_with_repo_and_issue(
        session=session,
        platform=platform,
        org_name=org_name,
        repo_name=repo_name,
        issue=number,
    )

    return await pledge_service.modify_pledge(
        session=session,
        repo=repo,
        pledge_id=pledge_id,
        updates=updates
    )

@router.get(
    "/me/pledges",
    response_model=list[PledgeRead],
)
async def list_personal_pledges(
    auth: Auth = Depends(Auth.current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[PledgeRead]:
    pledges = await pledge_service.list_by_pledging_user(session, auth.user.id)
    return [PledgeRead.from_db(p) for p in pledges]
