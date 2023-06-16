from typing import Sequence
from fastapi import APIRouter, Depends, HTTPException
import structlog

from polar.auth.dependencies import Auth
from polar.dashboard.schemas import (
    IssueDashboardRead,
    IssueListType,
    IssueSortBy,
    IssueStatus,
)
from polar.issue.schemas import IssuePublicRead
from polar.models import Organization
from polar.enums import Platforms
from polar.models.repository import Repository
from polar.models.user import User
from polar.postgres import AsyncSession, get_db_session
from polar.integrations.stripe.service import stripe
from polar.repository.schemas import RepositoryPublicRead
from polar.user_organization.schemas import UserOrganizationSettingsUpdate
from polar.user_organization.service import (
    user_organization as user_organization_service,
)

from .schemas import (
    OrganizationPrivateRead,
    OrganizationPublicPageRead,
    OrganizationPublicRead,
    OrganizationSettingsUpdate,
    OrganizationBadgeSettingsUpdate,
    OrganizationBadgeSettingsRead,
)
from .service import organization
from polar.issue.service import issue as issue_service
from polar.repository.service import repository as repository_service

log = structlog.get_logger()

router = APIRouter(tags=["organizations"])


@router.get("/{platform}/{org_name}", response_model=OrganizationPrivateRead)
async def get(
    platform: Platforms,
    org_name: str,
    auth: Auth = Depends(Auth.user_with_org_access),
    session: AsyncSession = Depends(get_db_session),
) -> OrganizationPrivateRead:
    return await _get_org_for_user(session, auth.organization, auth.user)


async def _get_org_for_user(
    session: AsyncSession, org: Organization, user: User
) -> OrganizationPrivateRead:
    res = OrganizationPrivateRead.from_orm(org)

    # Get personal settings
    settings = await user_organization_service.get_settings(session, user.id, org.id)
    res.email_notification_maintainer_issue_receives_backing = (
        settings.email_notification_maintainer_issue_receives_backing
    )
    res.email_notification_maintainer_issue_branch_created = (
        settings.email_notification_maintainer_issue_branch_created
    )
    res.email_notification_maintainer_pull_request_created = (
        settings.email_notification_maintainer_pull_request_created
    )
    res.email_notification_maintainer_pull_request_merged = (
        settings.email_notification_maintainer_pull_request_merged
    )
    res.email_notification_backed_issue_branch_created = (
        settings.email_notification_backed_issue_branch_created
    )
    res.email_notification_backed_issue_pull_request_created = (
        settings.email_notification_backed_issue_pull_request_created
    )
    res.email_notification_backed_issue_pull_request_merged = (
        settings.email_notification_backed_issue_pull_request_merged
    )

    return res


@router.get(
    "/{platform}/{org_name}/badge_settings",
    response_model=OrganizationBadgeSettingsRead,
)
async def get_badge_settings(
    platform: Platforms,
    org_name: str,
    auth: Auth = Depends(Auth.user_with_org_access),
    session: AsyncSession = Depends(get_db_session),
) -> OrganizationBadgeSettingsRead:
    settings = await organization.get_badge_settings(session, auth.organization)
    return settings


@router.put(
    "/{platform}/{org_name}/badge_settings",
    response_model=OrganizationBadgeSettingsUpdate,
)
async def update_badge_settings(
    platform: Platforms,
    org_name: str,
    settings: OrganizationBadgeSettingsUpdate,
    auth: Auth = Depends(Auth.user_with_org_access),
    session: AsyncSession = Depends(get_db_session),
) -> OrganizationBadgeSettingsUpdate:
    updated = await organization.update_badge_settings(
        session, auth.organization, settings
    )
    return updated


@router.put("/{platform}/{org_name}/settings", response_model=OrganizationPrivateRead)
async def update_settings(
    platform: Platforms,
    org_name: str,
    settings: OrganizationSettingsUpdate,
    auth: Auth = Depends(Auth.user_with_org_access),
    session: AsyncSession = Depends(get_db_session),
) -> OrganizationPrivateRead:
    updated = await organization.update_settings(session, auth.organization, settings)

    # update user settings
    user_settings = UserOrganizationSettingsUpdate(
        email_notification_maintainer_issue_receives_backing=settings.email_notification_maintainer_issue_receives_backing,
        email_notification_maintainer_issue_branch_created=settings.email_notification_maintainer_issue_branch_created,
        email_notification_maintainer_pull_request_created=settings.email_notification_maintainer_pull_request_created,
        email_notification_maintainer_pull_request_merged=settings.email_notification_maintainer_pull_request_merged,
        email_notification_backed_issue_branch_created=settings.email_notification_backed_issue_branch_created,
        email_notification_backed_issue_pull_request_created=settings.email_notification_backed_issue_pull_request_created,
        email_notification_backed_issue_pull_request_merged=settings.email_notification_backed_issue_pull_request_merged,
    )
    await user_organization_service.update_settings(
        session, auth.user.id, auth.organization.id, user_settings
    )

    return await _get_org_for_user(session, updated, auth.user)


@router.get(
    "/{platform}/{org_name}/public",
    response_model=OrganizationPublicPageRead,
)
async def get_public_issues(
    platform: Platforms,
    org_name: str,
    repo_name: str | None = None,
    session: AsyncSession = Depends(get_db_session),
) -> OrganizationPublicPageRead:
    org = await organization.get_by_name(session, platform, org_name)
    if not org:
        raise HTTPException(
            status_code=404,
            detail="Organization not found",
        )

    repositories: Sequence[Repository] = []

    all_org_repos = await repository_service.list_by_organization(
        session,
        organization_id=org.id,
    )
    all_org_repos = [r for r in all_org_repos if r.is_private is False]

    if repo_name:
        repo = await repository_service.get_by(
            session,
            organization_id=org.id,
            name=repo_name,
            is_private=False,
            # deleted_at=None,
        )

        if not repo:
            raise HTTPException(
                status_code=404,
                detail="Repository not found",
            )

        # repositories = [repo]
        issues_in_repos = [r for r in repositories if r.is_private is False]
    else:
        issues_in_repos = all_org_repos

    # if not issues_in_repos:
    #     raise HTTPException(
    #         status_code=404,
    #         detail="Repository not found",
    #     )

    issues_in_repos_ids = [r.id for r in issues_in_repos]

    (issues, count) = await issue_service.list_by_repository_type_and_status(
        session=session,
        repository_ids=issues_in_repos_ids,
        issue_list_type=IssueListType.issues,
        sort_by=IssueSortBy.issues_default,
        limit=50,
        include_statuses=[
            IssueStatus.backlog,
            IssueStatus.triaged,
            IssueStatus.in_progress,
            IssueStatus.pull_request,
        ],
    )

    return OrganizationPublicPageRead(
        organization=OrganizationPublicRead.from_orm(org),
        repositories=[RepositoryPublicRead.from_orm(r) for r in all_org_repos],
        issues=[IssuePublicRead.from_orm(i) for i in issues],
    )
