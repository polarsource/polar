from typing import Annotated

from fastapi import Depends, Path
from pydantic import (
    UUID4,
)

from polar.auth.dependencies import WebUserOrAnonymous
from polar.exceptions import ResourceNotFound
from polar.kit.db.postgres import AsyncSession
from polar.models import LicenseKey
from polar.openapi import APITag
from polar.postgres import get_db_session
from polar.routing import APIRouter

from ..schemas.license_key import LicenseKeyRead
from ..service.license_key import license_key as license_key_service

router = APIRouter(prefix="/license-keys", tags=[APITag.documented, APITag.featured])

LK = Annotated[str, Path(description="The license key")]

LicenseKeyNotFound = {
    "description": "License key not found.",
    "model": ResourceNotFound.schema(),
}


@router.get(
    "/{id}",
    response_model=LicenseKeyRead,
    responses={404: LicenseKeyNotFound},
)
async def get(
    auth_subject: WebUserOrAnonymous,
    id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> LicenseKey:
    """Get a license key."""
    lk = await license_key_service.get(session, id)
    if not lk:
        raise ResourceNotFound()

    return lk
