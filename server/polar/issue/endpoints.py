from typing import List, Sequence

from fastapi import APIRouter, Depends, HTTPException

from polar.auth.dependencies import Auth
from polar.integrations.github.schemas import GitHubIssue
from polar.models import Issue
from polar.enums import Platforms
from polar.postgres import AsyncSession, get_db_session
from polar.exceptions import ResourceNotFound

from polar.organization.service import organization as organization_service

from .schemas import ExternalGitHubIssueCreate, IssueRead, IssueReferenceRead
from .service import issue as issue_service

from polar.integrations.github.client import get_anonymous_client, get_user_client
from polar.integrations.github.service.issue import github_issue as github_issue_service
from polar.integrations.github.service.url import github_url
from polar.integrations.github.service.organization import (
    github_organization as github_organization_service
)

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
    "/{platform}/{org_name}/{repo_name}/issue/{issue_number}/add_badge",
    response_model=IssueRead,
)
async def add_polar_badge(
    platform: Platforms,
    org_name: str,
    repo_name: str,
    issue_number: int,
    auth: Auth = Depends(Auth.user_with_org_and_repo_access),
    session: AsyncSession = Depends(get_db_session),
) -> Issue:
    issue = await issue_service.get_by_number(
        session, platform, auth.organization.id, auth.repository.id, issue_number
    )
    if not issue:
        raise HTTPException(
            status_code=404,
            detail="Issue not found",
        )

    issue = await github_issue_service.add_polar_label(
        session, auth.organization, auth.repository, issue
    )

    return issue


@router.get(
    "/{platform}/{org_name}/{repo_name}/issue/{issue_number}/remove_badge",
    response_model=IssueRead,
)
async def remove_polar_badge(
    platform: Platforms,
    org_name: str,
    repo_name: str,
    issue_number: int,
    auth: Auth = Depends(Auth.user_with_org_and_repo_access),
    session: AsyncSession = Depends(get_db_session),
) -> Issue:
    issue = await issue_service.get_by_number(
        session, platform, auth.organization.id, auth.repository.id, issue_number
    )
    if not issue:
        raise HTTPException(
            status_code=404,
            detail="Issue not found",
        )

    issue = await github_issue_service.remove_polar_label(
        session, auth.organization, auth.repository, issue
    )

    return issue


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


@router.post(
    "/{platform}/external_issues", response_model=GitHubIssue
)
async def sync_external_issue(
    platform: Platforms,
    external_issue: ExternalGitHubIssueCreate,
    auth: Auth = Depends(Auth.optional_user),
    session: AsyncSession = Depends(get_db_session),
) -> GitHubIssue:
    if auth.user is None:
        client = get_anonymous_client()
    else:
        # If we have a user, make sure to use their GitHub auth, to use as little
        # anonymous rate limiting as possible
        client = await get_user_client(session, auth.user)
    urls = github_url.parse_urls(external_issue.url)

    if len(urls) != 1 or urls[0].owner is None or urls[0].repo is None:
        raise HTTPException(
            status_code=404,
            detail="No issue reference found",
        )

    try:
        await github_organization_service.sync_external_org_with_repo_and_issue(
            session,
            client=client,
            org_name=urls[0].owner,
            repo_name=urls[0].repo,
            issue_number=urls[0].number,
        )
        return urls[0]
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
