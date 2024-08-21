from fastapi import Depends
from pydantic import (
    UUID4,
)

from polar.authz.service import AccessType, Authz
from polar.exceptions import ResourceNotFound, Unauthorized
from polar.kit.db.postgres import AsyncSession
from polar.models import LicenseKey
from polar.openapi import APITag
from polar.postgres import get_db_session
from polar.routing import APIRouter

from . import auth
from .schemas import (
    LicenseKeyRead,
    LicenseKeyUpdate,
    LicenseKeyWithActivations,
    NotFoundResponse,
    UnauthorizedResponse,
)
from .service import license_key as license_key_service

router = APIRouter(prefix="/license-keys", tags=[APITag.documented, APITag.featured])


@router.get(
    "/{id}",
    response_model=LicenseKeyWithActivations,
    responses={
        401: UnauthorizedResponse,
        404: NotFoundResponse,
    },
)
async def get(
    auth_subject: auth.LicenseKeysRead,
    id: UUID4,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> LicenseKey:
    """Get a license key."""
    lk = await license_key_service.get_loaded(session, id)
    if not lk:
        raise ResourceNotFound()

    if not await authz.can(auth_subject.subject, AccessType.read, lk):
        raise Unauthorized()

    return lk


@router.patch(
    "/{id}",
    response_model=LicenseKeyRead,
    responses={
        401: UnauthorizedResponse,
        404: NotFoundResponse,
    },
)
async def update(
    auth_subject: auth.LicenseKeysWrite,
    id: UUID4,
    updates: LicenseKeyUpdate,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> LicenseKey:
    """Update a license key."""
    lk = await license_key_service.get_by_id(session, id)
    if not lk:
        raise ResourceNotFound()

    if not await authz.can(auth_subject.subject, AccessType.write, lk):
        raise Unauthorized()

    updated = await license_key_service.update(session, license_key=lk, updates=updates)
    return updated
