from fastapi import APIRouter, Depends, HTTPException

from polar.auth.dependencies import current_active_user
from polar.models import User, Organization
from polar.enums import Platforms
from polar.postgres import AsyncSession, get_db_session

from .schemas import OrganizationRead, OrganizationSettings
from .service import organization

router = APIRouter()


@router.put("/{platform}/{organization_name}/settings", response_model=OrganizationRead)
async def update_settings(
    platform: Platforms,
    organization_name: str,
    settings: OrganizationSettings,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_db_session),
) -> Organization:
    # TODO: Create auth dependency for user/org/repo access and implement it here ASAP
    org = await organization.get_by_name(session, platform, name=organization_name)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    updated = await organization.update_settings(session, org, settings)
    return updated
