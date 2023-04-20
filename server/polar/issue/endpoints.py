from typing import List, Sequence
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from polar.auth.dependencies import Auth
from polar.models import Issue
from polar.enums import Platforms
from polar.models.pledge import Pledge
from polar.pledge.schemas import State
from polar.postgres import AsyncSession, get_db_session
from polar.exceptions import ResourceNotFound

from polar.organization.service import organization as organization_service

from .schemas import IssueExtensionRead, IssueRead, IssueReferenceRead
from .service import issue as issue_service
from polar.pledge.service import pledge as pledge_service

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

@router.get(
    "/{platform}/{org_name}/{repo_name}/issues-for-extension",
    response_model=list[IssueExtensionRead]
)
async def list_issues_for_extension(
    platform: Platforms,
    org_name: str,
    repo_name: str,
    numbers: str,
    auth: Auth = Depends(Auth.user_with_org_and_repo_access),
    session: AsyncSession = Depends(get_db_session),
) -> list[IssueExtensionRead]:
    issue_numbers = [int(number) for number in numbers.split(",")]
    issues = await issue_service.list_by_repository_and_numbers(
        session=session, repository_id=auth.repository.id, numbers=issue_numbers)
    pledges = await pledge_service.get_by_issue_ids(
        session=session, issue_ids=[issue.id for issue in issues])

    pledges_by_issue_id: dict[UUID, list[Pledge]] = {}
    for pledge in pledges:
        if pledge.issue_id not in pledges_by_issue_id:
            pledges_by_issue_id[pledge.issue_id] = []
        pledges_by_issue_id[pledge.issue_id].append(pledge)
    
    ret = []
    for issue in issues:
        if pledges_by_issue_id.get(issue.id):
            issue_extension = IssueExtensionRead(
                number=issue.number,
                amount_pledged=sum([p.amount for p in pledges_by_issue_id[issue.id]
                                    if p.state == State.paid])
            )
            ret.append(issue_extension)

    return ret
