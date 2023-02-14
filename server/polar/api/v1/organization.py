from typing import Sequence

from fastapi import APIRouter, Depends

from polar.actions import organization
from polar.api.deps import current_active_user, get_db_session
from polar.models import Organization, User
from polar.postgres import AsyncSession
from polar.schema.organization import OrganizationSchema

router = APIRouter(prefix="/user/organizations", tags=["user.organizations"])


@router.get("", response_model=list[OrganizationSchema])
async def get_user_organizations(
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_db_session),
) -> Sequence[Organization]:
    orgs = await organization.get_all_by_user_id(session, user.id)
    return orgs
