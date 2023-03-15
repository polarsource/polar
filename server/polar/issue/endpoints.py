from typing import Sequence

from fastapi import APIRouter, Depends, HTTPException

from polar.auth.dependencies import Auth
from polar.models import Organization, Repository, Issue
from polar.enums import Platforms
from polar.postgres import AsyncSession, get_db_session
from polar.kit.schemas import Schema

from polar.repository.schemas import RepositoryRead
from polar.organization.schemas import OrganizationRead
from polar.organization.service import organization as organization_service

from .schemas import IssueRead
from .service import issue as issue_service

router = APIRouter(tags=["issues"])


# TODO: This is a bit of a mess. To be refactored once checkout is in-place
# and we can see all of the pieces together.
class IssuePledge(Schema):
    issue: IssueRead
    organization: OrganizationRead
    repository: RepositoryRead


async def get_public_org_repo_and_issue(
    session: AsyncSession,
    *,
    platform: Platforms,
    org_name: str,
    repo_name: str,
    number: int,
) -> tuple[Organization, Repository, Issue]:
    org_and_repo = await organization_service.get_with_repo(
        session,
        platform=platform,
        org_name=org_name,
        repo_name=repo_name,
    )
    if not org_and_repo:
        raise HTTPException(
            status_code=404,
            detail="Organization/repository combination not found",
        )

    organization, repository = org_and_repo
    issue = await issue_service.get_by_number(
        session,
        platform=platform,
        organization_id=organization.id,
        repository_id=repository.id,
        number=number,
    )
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    return (organization, repository, issue)


@router.get("/{platform}/{org_name}/{repo_name}/issues", response_model=list[IssueRead])
async def get_repository_issues(
    platform: Platforms,
    org_name: str,
    repo_name: str,
    auth: Auth = Depends(Auth.user_with_org_and_repo_access),
    session: AsyncSession = Depends(get_db_session),
) -> Sequence[Issue]:
    issues = await issue_service.list_by_repository(
        session=session, repository_id=auth.repository.id
    )
    return issues


@router.get(
    "/{platform}/{org_name}/{repo_name}/issues/{number}", response_model=IssueRead
)
async def get_public_issue(
    platform: Platforms,
    org_name: str,
    repo_name: str,
    number: int,
    session: AsyncSession = Depends(get_db_session),
) -> Issue:
    _, __, issue = await get_public_org_repo_and_issue(
        session,
        platform=platform,
        org_name=org_name,
        repo_name=repo_name,
        number=number,
    )
    return issue


@router.get(
    "/{platform}/{org_name}/{repo_name}/issues/{number}/pledge",
    response_model=IssuePledge,
)
async def get_public_issue_pledge(
    platform: Platforms,
    org_name: str,
    repo_name: str,
    number: int,
    session: AsyncSession = Depends(get_db_session),
) -> IssuePledge:
    organization, repository, issue = await get_public_org_repo_and_issue(
        session,
        platform=platform,
        org_name=org_name,
        repo_name=repo_name,
        number=number,
    )
    ret = IssuePledge(
        organization=OrganizationRead.from_orm(organization),
        repository=RepositoryRead.from_orm(repository),
        issue=IssueRead.from_orm(issue),
    )
    return ret
