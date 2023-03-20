from typing import Sequence

from fastapi import APIRouter, Depends, HTTPException

from polar.auth.dependencies import Auth
from polar.models import Issue
from polar.enums import Platforms
from polar.postgres import AsyncSession, get_db_session
from polar.exceptions import ResourceNotFound

from polar.organization.service import organization as organization_service

from .schemas import IssueRead
from .service import issue as issue_service

router = APIRouter(tags=["issues"])


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
    try:
        _, __, issue = await organization_service.get_with_repo_and_issue(
            session,
            platform=platform,
            org_name=org_name,
            repo_name=repo_name,
            issue=number,
        )
        return issue
    except ResourceNotFound:
        raise HTTPException(
            status_code=404,
            detail="Organization, repo and issue combination not found",
        )
