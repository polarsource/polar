from typing import List, Sequence

from fastapi import APIRouter, Depends, HTTPException

from polar.auth.dependencies import Auth
from polar.enums import Platforms
from polar.exceptions import ResourceNotFound
from polar.integrations.github.badge import GithubBadge
from polar.integrations.github.client import get_polar_client
from polar.integrations.github.service.issue import github_issue as github_issue_service
from polar.integrations.github.service.organization import (
    github_organization as github_organization_service,
)
from polar.kit.schemas import Schema
from polar.models import Issue
from polar.organization.schemas import Organization as OrganizationSchema
from polar.organization.service import organization as organization_service
from polar.postgres import AsyncSession, get_db_session
from polar.repository.schemas import RepositoryRead

from .schemas import (
    IssueRead,
    IssueReferenceRead,
    IssueUpdateBadgeMessage,
    PostIssueComment,
)
from .service import issue as issue_service

router = APIRouter(tags=["issues"])


class IssueResources(Schema):
    issue: IssueRead
    organization: OrganizationSchema | None
    repository: RepositoryRead | None


@router.get(
    "/{platform}/{org_name}/{repo_name}/issues/{number}", response_model=IssueResources
)
async def get_or_sync_external(
    platform: Platforms,
    org_name: str,
    repo_name: str,
    number: int,
    include: str = "organization,repository",
    session: AsyncSession = Depends(get_db_session),
) -> IssueResources:
    includes = include.split(",")
    client = get_polar_client()

    try:
        res = await github_organization_service.sync_external_org_with_repo_and_issue(
            session,
            client=client,
            org_name=org_name,
            repo_name=repo_name,
            issue_number=number,
        )
        org, repo, issue = res
    except ResourceNotFound:
        raise HTTPException(
            status_code=404,
            detail="Organization, repo and issue combination not found",
        )

    included_org = None
    if "organization" in includes:
        included_org = OrganizationSchema.from_orm(org)

    included_repo = None
    if "repository" in includes:
        included_repo = RepositoryRead.from_orm(repo)

    return IssueResources(
        issue=IssueRead.from_orm(issue),
        organization=included_org,
        repository=included_repo,
    )


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


@router.post(
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


@router.post(
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


@router.post(
    "/{platform}/{org_name}/{repo_name}/issue/{issue_number}/comment",
    response_model=IssueRead,
)
async def add_issue_comment(
    platform: Platforms,
    org_name: str,
    repo_name: str,
    issue_number: int,
    comment: PostIssueComment,
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

    message = comment.message

    if comment.append_badge:
        badge = GithubBadge(
            organization=auth.organization,
            repository=auth.repository,
            issue=issue,
        )
        message += badge.badge_markdown("")

    await github_issue_service.add_comment_as_user(
        session,
        auth.organization,
        auth.repository,
        issue,
        auth.user,
        message,
    )

    return issue


@router.post(
    "/{platform}/{org_name}/{repo_name}/issue/{issue_number}/badge_message",
    response_model=IssueRead,
)
async def badge_with_message(
    platform: Platforms,
    org_name: str,
    repo_name: str,
    issue_number: int,
    badge_message: IssueUpdateBadgeMessage,
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

    issue = await github_issue_service.set_issue_badge_custom_message(
        session, issue, badge_message.message
    )

    await github_issue_service.embed_badge(
        session,
        organization=auth.organization,
        repository=auth.repository,
        issue=issue,
        triggered_from_label=True,
    )

    return issue
