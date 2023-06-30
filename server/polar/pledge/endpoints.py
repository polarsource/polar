from typing import Sequence
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from polar.auth.dependencies import Auth
from polar.enums import Platforms
from polar.exceptions import NotPermitted, ResourceNotFound
from polar.integrations.github.client import get_polar_client
from polar.integrations.github.service.organization import (
    github_organization as gh_organization,
)
from polar.issue.schemas import IssueRead
from polar.models import Pledge, Repository
from polar.models.user import User
from polar.models.user_organization import UserOrganization
from polar.organization.schemas import OrganizationPublicRead
from polar.organization.service import organization as organization_service
from polar.postgres import AsyncSession, get_db_session
from polar.repository.schemas import RepositoryRead
from polar.user_organization.service import (
    user_organization as user_organization_service,
)

from .schemas import (
    ConfirmPledgesResponse,
    PledgeCreate,
    PledgeMutationResponse,
    PledgeRead,
    PledgeResources,
    PledgeUpdate,
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
    includes = include.split(",")
    client = get_polar_client()

    try:
        org, repo, issue = await gh_organization.sync_external_org_with_repo_and_issue(
            session,
            client=client,
            org_name=org_name,
            repo_name=repo_name,
            issue_number=number,
        )
    except ResourceNotFound:
        raise HTTPException(
            status_code=404,
            detail="Organization, repo and issue combination not found",
        )

    if pledge_id:
        pledge = await get_pledge_or_404(
            session,
            pledge_id=pledge_id,
            for_repository=repo,
        )
        included_pledge = PledgeRead.from_db(pledge)

    included_org = None
    if "organization" in includes:
        included_org = OrganizationPublicRead.from_orm(org)

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


@router.get(
    "/{platform}/{org_name}/{repo_name}/issues/{number}/pledges/{pledge_id}",
    response_model=PledgeRead,
)
async def get_pledge(
    platform: Platforms,
    org_name: str,
    repo_name: str,
    number: int,
    pledge_id: UUID,
    session: AsyncSession = Depends(get_db_session),
    auth: Auth = Depends(Auth.current_user),
) -> PledgeRead:
    pledge = await pledge_service.get_with_loaded(session, pledge_id)
    if not pledge:
        raise HTTPException(status_code=404, detail="Pledge not found")

    user_memberships = await user_organization_service.list_by_user_id(
        session,
        auth.user.id,
    )

    if not pledge_service.user_can_read_pledge(auth.user, pledge, user_memberships):
        raise HTTPException(
            status_code=403,
            detail="Access denied",
        )

    return PledgeRead.from_db(pledge)


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
    auth: Auth = Depends(Auth.optional_user),
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
        platform=platform,
        repo=repo,
        user=auth.user,
        pledge_id=pledge_id,
        updates=updates,
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


@router.get(
    "/{platform}/{org_name}/pledges",
    response_model=list[PledgeResources],
)
async def list_organization_pledges(
    platform: Platforms,
    org_name: str,
    auth: Auth = Depends(Auth.user_with_org_access),
    session: AsyncSession = Depends(get_db_session),
) -> list[PledgeResources]:
    pledges = await pledge_service.list_by_receiving_organization(
        session, auth.organization.id
    )
    return [
        PledgeResources(
            pledge=PledgeRead.from_db(p),
            issue=IssueRead.from_orm(p.issue),
            repository=RepositoryRead.from_orm(p.to_repository),
            organization=OrganizationPublicRead.from_orm(p.to_organization),
        )
        for p in pledges
    ]


@router.post(
    "/{platform}/{org_name}/{repo_name}/issues/{number}/confirm_pledges",
    response_model=ConfirmPledgesResponse,
)
async def confirm_pledges(
    platform: Platforms,
    org_name: str,
    repo_name: str,
    number: int,
    auth: Auth = Depends(Auth.current_user),
    session: AsyncSession = Depends(get_db_session),
) -> ConfirmPledgesResponse:
    org, repo, issue = await organization_service.get_with_repo_and_issue(
        session=session,
        platform=platform,
        org_name=org_name,
        repo_name=repo_name,
        issue=number,
    )

    user_memberships = await user_organization_service.list_by_user_id(
        session,
        auth.user.id,
    )

    if not pledge_service.user_can_admin_received_pledge_on_issue(
        issue, user_memberships
    ):
        raise HTTPException(
            status_code=403,
            detail="Access denied",
        )

    await pledge_service.mark_pending_by_issue_id(
        session,
        issue_id=issue.id,
    )

    return ConfirmPledgesResponse()


@router.post(
    "/pledges/{pledge_id}/dispute",
    response_model=PledgeRead,
)
async def dispute_pledge(
    pledge_id: UUID,
    reason: str,
    auth: Auth = Depends(Auth.current_user),
    session: AsyncSession = Depends(get_db_session),
) -> PledgeRead:
    pledge = await pledge_service.get(session, pledge_id)
    if not pledge:
        raise HTTPException(status_code=404, detail="Pledge not found")

    # authorize
    user_memberships = await user_organization_service.list_by_user_id(
        session,
        auth.user.id,
    )

    if not pledge_service.user_can_admin_sender_pledge(
        auth.user, pledge, user_memberships
    ):
        raise HTTPException(
            status_code=403,
            detail="Access denied",
        )

    await pledge_service.mark_disputed(
        session, pledge_id=pledge_id, by_user_id=auth.user.id, reason=reason
    )

    # get pledge again
    pledge = await pledge_service.get_with_loaded(session, pledge_id)
    if not pledge:
        raise HTTPException(status_code=404, detail="Pledge not found")

    return PledgeRead.from_db(pledge)
