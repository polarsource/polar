from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException

from polar.auth.dependencies import Auth
from polar.dashboard.schemas import (
    IssueListType,
    IssueSortBy,
    IssueStatus,
)
from polar.enums import Platforms
from polar.issue.schemas import IssuePublicRead
from polar.issue.service import issue as issue_service
from polar.postgres import AsyncSession, get_db_session
from polar.repository.schemas import RepositoryPublicRead
from polar.repository.service import repository as repository_service
from polar.tags.api import Tags

from .schemas import (
    Organization as OrganizationSchema,
)
from .schemas import (
    OrganizationBadgeSettingsRead,
    OrganizationBadgeSettingsUpdate,
    OrganizationPrivateRead,
    OrganizationPublicPageRead,
    OrganizationSettingsUpdate,
)
from .service import organization

log = structlog.get_logger()

router = APIRouter(tags=["organizations"])


@router.get(
    "/organizations/{id}",
    response_model=OrganizationSchema,
    tags=[Tags.PUBLIC],
    description="Get an organization",
    status_code=200,
    responses={404: {}},
)
async def get(
    id: UUID,
    auth: Auth = Depends(Auth.optional_user),
    session: AsyncSession = Depends(get_db_session),
) -> OrganizationSchema:
    org = await organization.get(session, id=id)

    if org:
        return OrganizationSchema.from_orm(org)

    raise HTTPException(
        status_code=404,
        detail="Organization not found",
    )


@router.get(
    "/{platform}/{org_name}",
    response_model=OrganizationPrivateRead,
    tags=[Tags.INTERNAL],
)
async def getInternal(
    platform: Platforms,
    org_name: str,
    auth: Auth = Depends(Auth.user_with_org_access),
) -> OrganizationPrivateRead:
    return OrganizationPrivateRead.from_orm(auth.organization)


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
    return await organization.get_badge_settings(session, auth.organization)


@router.put(
    "/{platform}/{org_name}/badge_settings",
    response_model=OrganizationBadgeSettingsUpdate,
    tags=[Tags.INTERNAL],
)
async def update_badge_settings(
    platform: Platforms,
    org_name: str,
    settings: OrganizationBadgeSettingsUpdate,
    auth: Auth = Depends(Auth.user_with_org_access),
    session: AsyncSession = Depends(get_db_session),
) -> OrganizationBadgeSettingsUpdate:
    return await organization.update_badge_settings(
        session, auth.organization, settings
    )


@router.put(
    "/{platform}/{org_name}/settings",
    response_model=OrganizationPrivateRead,
    tags=[Tags.INTERNAL],
)
async def update_settings(
    platform: Platforms,
    org_name: str,
    settings: OrganizationSettingsUpdate,
    auth: Auth = Depends(Auth.user_with_org_access),
    session: AsyncSession = Depends(get_db_session),
) -> OrganizationPrivateRead:
    updated = await organization.update_settings(session, auth.organization, settings)
    return OrganizationPrivateRead.from_orm(updated)


@router.get(
    "/{platform}/{org_name}/public",
    response_model=OrganizationPublicPageRead,
    tags=[Tags.INTERNAL],
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

    all_org_repos = await repository_service.list_by_organization(
        session,
        organization_id=org.id,
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
        organization=OrganizationSchema.from_orm(org),
        repositories=[RepositoryPublicRead.from_orm(r) for r in all_org_repos],
        issues=[IssuePublicRead.from_orm(i) for i in issues],
        total_issue_count=count,
    )
