from fastapi import APIRouter, Depends
import structlog

from polar.auth.dependencies import Auth
from polar.models import Organization
from polar.enums import Platforms
from polar.models.user import User
from polar.postgres import AsyncSession, get_db_session
from polar.integrations.stripe.service import stripe
from polar.user_organization.schemas import UserOrganizationSettingsUpdate
from polar.user_organization.service import (
    user_organization as user_organization_service,
)

from .schemas import (
    OrganizationPrivateRead,
    OrganizationSettingsUpdate,
    OrganizationBadgeSettingsUpdate,
    OrganizationBadgeSettingsRead,
)
from .service import organization

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
