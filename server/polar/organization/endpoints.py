from datetime import datetime
from typing import List
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException

from polar.auth.dependencies import Auth
from polar.enums import Platforms
from polar.integrations.github.badge import GithubBadge
from polar.postgres import AsyncSession, get_db_session
from polar.repository.schemas import RepositoryLegacyRead
from polar.repository.service import repository as repository_service
from polar.tags.api import Tags
from polar.types import ListResource, Pagination

from .schemas import (
    Organization as OrganizationSchema,
)
from .schemas import (
    OrganizationBadgeSettingsRead,
    OrganizationBadgeSettingsUpdate,
    OrganizationPrivateBase,
    OrganizationSettingsRead,
    OrganizationSettingsUpdate,
    RepositoryBadgeSettingsRead,
)
from .service import organization

log = structlog.get_logger()

router = APIRouter(tags=["organizations"])


@router.get(
    "/organizations",
    response_model=ListResource[OrganizationSchema],
    tags=[Tags.PUBLIC],
    description="List organizations that the authenticated user is a member of. Requires authentication.",  # noqa: E501
    summary="List organizations (Public API)",
    status_code=200,
)
async def list(
    auth: Auth = Depends(Auth.current_user),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[OrganizationSchema]:
    if not auth.user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    orgs = await organization.list_all_orgs_by_user_id(session, auth.user.id)
    return ListResource(
        items=[OrganizationSchema.from_db(o) for o in orgs],
        pagination=Pagination(total_count=len(orgs)),
    )


@router.get(
    "/organizations/search",
    response_model=ListResource[OrganizationSchema],
    tags=[Tags.PUBLIC],
    description="Search organizations.",
    summary="Search organizations (Public API)",
    status_code=200,
)
async def search(
    platform: Platforms | None = None,
    organization_name: str | None = None,
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[OrganizationSchema]:
    # Search by platform and organization name.
    # Currently the only way to search
    if platform and organization_name:
        org = await organization.get_by_name(session, platform, organization_name)
        if org:
            return ListResource(
                items=[OrganizationSchema.from_db(org)],
                pagination=Pagination(total_count=0),
            )

    # no org found
    return ListResource(
        items=[],
        pagination=Pagination(total_count=0),
    )


@router.get(
    "/organizations/lookup",
    response_model=OrganizationSchema,
    tags=[Tags.PUBLIC],
    description="Lookup organization. Like search but returns at only one organization.",  # noqa: E501
    summary="Lookup organization (Public API)",
    status_code=200,
    responses={404: {}},
)
async def lookup(
    platform: Platforms | None = None,
    organization_name: str | None = None,
    session: AsyncSession = Depends(get_db_session),
) -> OrganizationSchema:
    # Search by platform and organization name.
    # Currently the only way to search
    if platform and organization_name:
        org = await organization.get_by_name(session, platform, organization_name)
        if org:
            return OrganizationSchema.from_db(org)

    raise HTTPException(
        status_code=404,
        detail="Organization not found ",
    )


@router.get(
    "/organizations/{id}",
    response_model=OrganizationSchema,
    tags=[Tags.PUBLIC],
    description="Get organization",
    status_code=200,
    summary="Get organization (Public API)",
    responses={404: {}},
)
async def get(
    id: UUID,
    auth: Auth = Depends(Auth.optional_user),
    session: AsyncSession = Depends(get_db_session),
) -> OrganizationSchema:
    org = await organization.get(session, id=id)

    if not org:
        raise HTTPException(
            status_code=404,
            detail="Organization not found",
        )

    return OrganizationSchema.from_db(org)


#
# Internal APIs below
#


# Internal model
class OrganizationPrivateRead(OrganizationPrivateBase, OrganizationSettingsRead):
    id: UUID
    created_at: datetime
    modified_at: datetime | None

    # TODO: remove ASAP!
    # The import of RepositorySchema is why this definition needs to live here, and
    # not in schemas.
    repositories: List[RepositoryLegacyRead] | None

    class Config:
        orm_mode = True


@router.get(
    "/{platform}/{org_name}",
    response_model=OrganizationPrivateRead,
    tags=[Tags.INTERNAL],
    deprecated=True,  # Use the public get endpoint instead
    summary="Get an organization (Internal API)",
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
    summary="Get badge settings (Internal API)",
)
async def get_badge_settings(
    platform: Platforms,
    org_name: str,
    auth: Auth = Depends(Auth.user_with_org_access),
    session: AsyncSession = Depends(get_db_session),
) -> OrganizationBadgeSettingsRead:
    repositories = await repository_service.list_by(
        session, org_ids=[auth.organization.id], order_by_open_source=True
    )

    synced = await repository_service.get_repositories_synced_count(
        session, auth.organization
    )

    repos = []
    for repo in repositories:
        open_issues = repo.open_issues or 0
        synced_data = synced.get(
            repo.id,
            {
                "synced_issues": 0,
                "auto_embedded_issues": 0,
                "label_embedded_issues": 0,
                "pull_requests": 0,
            },
        )
        synced_issues = synced_data["synced_issues"]
        if synced_issues > open_issues:
            open_issues = synced_issues

        is_sync_completed = synced_issues == open_issues

        repos.append(
            RepositoryBadgeSettingsRead(
                id=repo.id,
                avatar_url=auth.organization.avatar_url,
                badge_auto_embed=repo.pledge_badge_auto_embed,
                name=repo.name,
                synced_issues=synced_issues,
                auto_embedded_issues=synced_data["auto_embedded_issues"],
                label_embedded_issues=synced_data["label_embedded_issues"],
                pull_requests=synced_data["pull_requests"],
                open_issues=open_issues,
                is_private=repo.is_private,
                is_sync_completed=is_sync_completed,
            )
        )

    message = auth.organization.default_badge_custom_content
    if not message:
        message = GithubBadge.generate_default_promotion_message(auth.organization)

    return OrganizationBadgeSettingsRead(
        show_amount=auth.organization.pledge_badge_show_amount,
        minimum_amount=auth.organization.pledge_minimum_amount,
        message=message,
        repositories=repos,
    )


@router.put(
    "/{platform}/{org_name}/badge_settings",
    response_model=OrganizationBadgeSettingsUpdate,
    tags=[Tags.INTERNAL],
    summary="Update badge settings (Internal API)",
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
    summary="Update organization settings (Internal API)",
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
