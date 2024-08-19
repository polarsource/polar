from typing import Annotated

from fastapi import Depends, Path

from polar.auth.dependencies import WebUserOrAnonymous
from polar.kit.db.postgres import AsyncSession
from polar.models import LicenseKey
from polar.openapi import APITag
from polar.postgres import get_db_session
from polar.routing import APIRouter

from ..schemas.license_key import LicenseKeyRead
from ..service.license_key import license_key as license_key_service

router = APIRouter(prefix="/license-keys", tags=[APITag.documented, APITag.featured])

LK = Annotated[str, Path(description="The license key")]


@router.get(
    "/{key}",
    response_model=LicenseKeyRead,
    # responses={404: OrderNotFound},
)
async def get(
    auth_subject: WebUserOrAnonymous,
    key: LK,
    session: AsyncSession = Depends(get_db_session),
) -> LicenseKey:
    """Get a license key."""
    return await license_key_service.get_or_raise_by_key(session, key=key)
