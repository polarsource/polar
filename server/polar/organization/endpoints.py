from fastapi import APIRouter, Depends

from polar.auth.dependencies import Auth
from polar.models import Organization
from polar.enums import Platforms
from polar.postgres import AsyncSession, get_db_session

from .schemas import OrganizationRead, OrganizationSettingsUpdate
from .service import organization

router = APIRouter(tags=["organizations"])


@router.put("/{platform}/{organization_name}/settings", response_model=OrganizationRead)
async def update_settings(
    platform: Platforms,
    org_name: str,
    settings: OrganizationSettingsUpdate,
    auth: Auth = Depends(Auth.user_with_org_access),
    session: AsyncSession = Depends(get_db_session),
) -> Organization:
    updated = await organization.update_settings(session, auth.organization, settings)
    return updated
