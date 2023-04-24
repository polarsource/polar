from typing import List, Sequence
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from polar.auth.dependencies import Auth
from polar.models import Issue
from polar.enums import Platforms
from polar.models.pledge import Pledge
from polar.pledge.schemas import PledgeRead, State
from polar.postgres import AsyncSession, get_db_session
from polar.exceptions import ResourceNotFound

from polar.organization.service import organization as organization_service

from .schemas import IssueRead, IssueReferenceRead
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


@router.get(
    "/{platform}/{org_name}/{repo_name}/issues/{number}/references",
    response_model=List[IssueReferenceRead],
)
async def get_issue_references(
    platform: Platforms,
    org_name: str,
    repo_name: str,
    number: int,
    auth: Auth = Depends(Auth.user_with_org_and_repo_access),
    session: AsyncSession = Depends(get_db_session),
) -> Sequence[IssueReferenceRead]:
    try:
        _, __, issue = await organization_service.get_with_repo_and_issue(
            session,
            platform=platform,
            org_name=org_name,
            repo_name=repo_name,
            issue=number,
        )

    except ResourceNotFound:
        raise HTTPException(
            status_code=404,
            detail="Organization, repo and issue combination not found",
        )

    if not issue:

        raise HTTPException(
            status_code=404,
            detail="Issue not found",
        )

    refs = await issue_service.list_issue_references(session, issue)
    return [IssueReferenceRead.from_model(r) for r in refs]
