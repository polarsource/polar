from typing import List, Sequence
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import Field

from polar.auth.dependencies import Auth
from polar.dashboard.schemas import IssueListType, IssueSortBy, IssueStatus
from polar.enums import Platforms
from polar.exceptions import ResourceNotFound
from polar.integrations.github.badge import GithubBadge
from polar.integrations.github.client import get_polar_client
from polar.integrations.github.service.issue import github_issue as github_issue_service
from polar.integrations.github.service.organization import (
    github_organization as github_organization_service,
)
from polar.kit.extensions.sqlalchemy import sql
from polar.kit.schemas import Schema
from polar.models import Issue
from polar.organization.schemas import Organization as OrganizationSchema
from polar.organization.service import organization as organization_service
from polar.pledge.service import pledge as pledge_service
from polar.postgres import AsyncSession, get_db_session
from polar.repository.endpoints import user_can_read, user_can_write
from polar.repository.schemas import Repository as RepositorySchema
from polar.repository.service import repository as repository_service
from polar.tags.api import Tags
from polar.types import ListResource
from polar.user_organization.service import (
    user_organization as user_organization_service,
)

from .schemas import (
    ConfirmIssue,
    IssuePublicRead,
    IssueRead,
    IssueReferenceRead,
    IssueUpdateBadgeMessage,
    OrganizationPublicPageRead,
    PostIssueComment,
    UpdateIssue,
)
from .schemas import Issue as IssueSchema
from .service import issue as issue_service

router = APIRouter(tags=["issues"])


@router.get(
    "/issues/search",
    response_model=ListResource[IssueSchema],
    tags=[Tags.PUBLIC],
    description="Search issues.",
    summary="Search issues (Public API)",
    status_code=200,
    responses={404: {}},
)
async def search(
    platform: Platforms,
    organization_name: str,
    repository_name: str | None = None,
    sort: IssueSortBy = Query(
        default=IssueSortBy.issues_default, description="Issue sorting method"
    ),
    have_pledge: bool
    | None = Query(
        default=None,
        description="Set to true to only return issues that have a pledge behind them",
    ),
    have_badge: bool
    | None = Query(
        default=None,
        description="Set to true to only return issues that have the Polar badge in the issue description",  # noqa: E501
    ),
    session: AsyncSession = Depends(get_db_session),
    auth: Auth = Depends(Auth.optional_user),
) -> ListResource[IssueSchema]:
    org = await organization_service.get_by_name(session, platform, organization_name)
    if not org:
        raise HTTPException(
            status_code=404,
            detail="Organization not found",
        )

    all_org_repos = await repository_service.list_by(
        session,
        org_ids=[org.id],
    )
    all_org_repos = [
        r for r in all_org_repos if r.is_private is False and r.is_archived is False
    ]

    if repository_name:
        repo = await repository_service.get_by(
            session,
            organization_id=org.id,
            name=repository_name,
            is_private=False,
            is_archived=False,
            deleted_at=None,
        )

        if not repo:
            raise HTTPException(
                status_code=404,
                detail="Repository not found",
            )

        issues_in_repos = [repo]
    else:
        issues_in_repos = all_org_repos

    issues_in_repos_ids = [r.id for r in issues_in_repos]

    (issues, count) = await issue_service.list_by_repository_type_and_status(
        session=session,
        repository_ids=issues_in_repos_ids,
        issue_list_type=IssueListType.issues,
        sort_by=sort,
        limit=50,
        include_statuses=[
            IssueStatus.backlog,
            IssueStatus.triaged,
            IssueStatus.in_progress,
            IssueStatus.pull_request,
        ],
        load_repository=True,
        have_pledge=have_pledge,
        have_polar_badge=have_badge,
    )

    return ListResource(items=[IssueSchema.from_db(i) for i in issues])


@router.get(
    "/issues/{id}",
    response_model=IssueSchema,
    tags=[Tags.PUBLIC],
    description="Get issue",
    summary="Get issue (Public API)",
)
async def get(
    id: UUID,
    session: AsyncSession = Depends(get_db_session),
    auth: Auth = Depends(Auth.optional_user),
) -> IssueSchema:
    issue = await issue_service.get_loaded(session, id)

    if not issue:
        raise HTTPException(
            status_code=404,
            detail="Issue not found",
        )

    if not await user_can_read(session, auth, issue.repository):
        raise HTTPException(
            status_code=404,
            detail="Issue not found",
        )

    return IssueSchema.from_db(issue)


@router.post(
    "/issues/{id}",
    response_model=IssueSchema,
    tags=[Tags.PUBLIC],
    description="Update issue. Requires authentication.",
    summary="Update issue. (Public API)",
)
async def update(
    id: UUID,
    update: UpdateIssue,
    session: AsyncSession = Depends(get_db_session),
    auth: Auth = Depends(Auth.current_user),
) -> IssueSchema:
    issue = await issue_service.get_loaded(session, id)

    if not issue:
        raise HTTPException(
            status_code=404,
            detail="Issue not found",
        )

    if not await user_can_write(session, auth, issue.repository):
        raise HTTPException(
            status_code=401,
            detail="Unauthorized",
        )

    updated = False

    if update.funding_goal:
        if update.funding_goal.currency != "USD":
            raise HTTPException(
                status_code=400,
                detail="Unexpected currency. Currency must be USD.",
            )

        issue.funding_goal = update.funding_goal.amount
        updated = True

    if updated:
        await issue.save(session)

    return IssueSchema.from_db(issue)


@router.post(
    "/issues/{id}/confirm_solved",
    response_model=IssueSchema,
    tags=[Tags.PUBLIC],
    description="Mark an issue as confirmed solved, and configure issue reward splits. Enables payouts of pledges. Can only be done once per issue. Requires authentication.",  # noqa: E501
    summary="Mark an issue as confirmed solved. (Public API)",
)
async def confirm(
    id: UUID,
    body: ConfirmIssue,
    auth: Auth = Depends(Auth.current_user),
    session: AsyncSession = Depends(get_db_session),
) -> IssueSchema:
    issue = await issue_service.get_loaded(session, id)
    if not issue:
        raise HTTPException(
            status_code=404,
            detail="Issue not found",
        )

    if not await user_can_write(session, auth, issue.repository):
        raise HTTPException(
            status_code=401,
            detail="Unauthorized",
        )

    user_memberships = await user_organization_service.list_by_user_id(
        session,
        auth.user.id,
    )

    if not pledge_service.user_can_admin_received_pledge_on_issue(
        issue, user_memberships
    ):
        raise HTTPException(
            status_code=401,
            detail="Access denied",
        )

    try:
        await pledge_service.create_issue_rewards(
            session, issue_id=issue.id, splits=body.splits
        )
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail="Failed to set splits, invalid configuration, or this issue might already be confirmed.",  # noqa: E501
        ) from e

    # mark issue as confirmed
    await issue_service.mark_confirmed_solved(
        session, issue_id=issue.id, by_user_id=auth.user.id
    )

    # mark pledges as PENDING
    await pledge_service.mark_pending_by_issue_id(session, issue_id=issue.id)

    await pledge_service.issue_confirmed_discord_alert(issue=issue)

    # get for return
    issue = await issue_service.get_loaded(session, id)

    if not issue:
        raise HTTPException(
            status_code=404,
            detail="Issue not found",
        )

    return IssueSchema.from_db(issue)


#
# Internal APIs below
#


class IssueResources(Schema):
    issue: IssueSchema
    organization: OrganizationSchema | None
    repository: RepositorySchema | None


@router.get(
    "/{platform}/{org_name}/{repo_name}/issues/{number}",
    response_model=IssueResources,
    tags=[Tags.INTERNAL],
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
        org, repo, tmp_issue = res
    except ResourceNotFound:
        raise HTTPException(
            status_code=404,
            detail="Organization, repo and issue combination not found",
        )

    included_org = None
    if "organization" in includes:
        included_org = OrganizationSchema.from_db(org)

    included_repo = None
    if "repository" in includes:
        included_repo = RepositorySchema.from_db(repo)

    # get for return
    issue = await issue_service.get_loaded(session, tmp_issue.id)
    if not issue:
        raise HTTPException(
            status_code=404,
            detail="Issue not found",
        )

    return IssueResources(
        issue=IssueSchema.from_db(issue),
        organization=included_org,
        repository=included_repo,
    )


@router.get(
    "/{platform}/{org_name}/{repo_name}/issues",
    response_model=list[IssueRead],
    tags=[Tags.INTERNAL],
)
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
    response_model=IssueSchema,
    tags=[Tags.INTERNAL],
)
async def add_polar_badge(
    platform: Platforms,
    org_name: str,
    repo_name: str,
    issue_number: int,
    auth: Auth = Depends(Auth.user_with_org_and_repo_access),
    session: AsyncSession = Depends(get_db_session),
) -> IssueSchema:
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

    # get for return
    issue_ret = await issue_service.get_loaded(session, issue.id)
    if not issue_ret:
        raise HTTPException(
            status_code=404,
            detail="Issue not found",
        )

    return IssueSchema.from_db(issue_ret)


@router.post(
    "/{platform}/{org_name}/{repo_name}/issue/{issue_number}/remove_badge",
    response_model=IssueSchema,
)
async def remove_polar_badge(
    platform: Platforms,
    org_name: str,
    repo_name: str,
    issue_number: int,
    auth: Auth = Depends(Auth.user_with_org_and_repo_access),
    session: AsyncSession = Depends(get_db_session),
) -> IssueSchema:
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

    # get for return
    issue_ret = await issue_service.get_loaded(session, issue.id)
    if not issue_ret:
        raise HTTPException(
            status_code=404,
            detail="Issue not found",
        )

    return IssueSchema.from_db(issue_ret)


@router.get(
    "/{platform}/{org_name}/{repo_name}/issues/{number}/references",
    response_model=List[IssueReferenceRead],
    tags=[Tags.INTERNAL],
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
    tags=[Tags.INTERNAL],
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
        # Crucial with newlines. See: https://github.com/polarsource/polar/issues/868
        message += "\n\n"
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
    tags=[Tags.INTERNAL],
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


@router.get(
    "/{platform}/{org_name}/public",
    response_model=OrganizationPublicPageRead,
    tags=[Tags.INTERNAL],
    summary="Get organization public issues (Internal API)",
)
async def get_public_issues(
    platform: Platforms,
    org_name: str,
    repo_name: str | None = None,
    session: AsyncSession = Depends(get_db_session),
) -> OrganizationPublicPageRead:
    org = await organization_service.get_by_name(session, platform, org_name)
    if not org:
        raise HTTPException(
            status_code=404,
            detail="Organization not found",
        )

    all_org_repos = await repository_service.list_by(
        session,
        org_ids=[org.id],
        load_organization=True,
    )
    all_org_repos = [
        r for r in all_org_repos if r.is_private is False and r.is_archived is False
    ]

    if repo_name:
        repo = await repository_service.get_by(
            session,
            organization_id=org.id,
            name=repo_name,
            is_private=False,
            is_archived=False,
            deleted_at=None,
        )

        if not repo:
            raise HTTPException(
                status_code=404,
                detail="Repository not found",
            )

        issues_in_repos = [repo]
    else:
        issues_in_repos = all_org_repos

    issues_in_repos_ids = [r.id for r in issues_in_repos]

    (issues, count) = await issue_service.list_by_repository_type_and_status(
        session=session,
        repository_ids=issues_in_repos_ids,
        issue_list_type=IssueListType.issues,
        sort_by=IssueSortBy.issues_default,
        limit=50,
        have_polar_badge=True,
        include_statuses=[
            IssueStatus.backlog,
            IssueStatus.triaged,
            IssueStatus.in_progress,
            IssueStatus.pull_request,
        ],
    )

    return OrganizationPublicPageRead(
        organization=OrganizationSchema.from_db(org),
        repositories=[RepositorySchema.from_db(r) for r in all_org_repos],
        issues=[IssuePublicRead.from_orm(i) for i in issues],
        total_issue_count=count,
    )
