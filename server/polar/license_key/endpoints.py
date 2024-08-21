from typing import Annotated

from fastapi import Depends, Path
from pydantic import (
    UUID4,
)

from polar.authz.service import AccessType, Authz
from polar.exceptions import NotPermitted, ResourceNotFound, Unauthorized
from polar.kit.db.postgres import AsyncSession
from polar.models import LicenseKey
from polar.openapi import APITag
from polar.organization.service import organization as organization_service
from polar.postgres import get_db_session
from polar.routing import APIRouter

from . import auth
from .schemas import (
    LicenseKeyRead,
    LicenseKeyUpdate,
    LicenseKeyWithActivations,
)
from .service import license_key as license_key_service

router = APIRouter(prefix="/license-keys", tags=[APITag.documented, APITag.featured])

LK = Annotated[str, Path(description="The license key")]

LicenseKeyNotFound = {
    "description": "License key not found.",
    "model": ResourceNotFound.schema(),
}

NotAuthorized = {
    "description": "Not authorized to manage license key.",
    "model": Unauthorized.schema(),
}

ActivationNotPermitted = {
    "description": "License key activation not required or permitted (limit reached).",
    "model": NotPermitted.schema(),
}


@router.get(
    "/{id}",
    response_model=LicenseKeyWithActivations,
    responses={
        401: NotAuthorized,
        404: LicenseKeyNotFound,
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

    organization = await organization_service.get(session, lk.benefit.organization_id)
    if not organization:
        raise ResourceNotFound()

    return lk


@router.patch(
    "/{id}",
    response_model=LicenseKeyRead,
    responses={
        401: NotAuthorized,
        404: LicenseKeyNotFound,
    },
)
async def update(
    auth_subject: auth.LicenseKeysRead,
    id: UUID4,
    updates: LicenseKeyUpdate,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> LicenseKey:
    """Update a license key."""
    lk = await license_key_service.get_by_id(session, id)
    if not lk:
        raise ResourceNotFound()

    organization = await organization_service.get(session, lk.benefit.organization_id)
    if not organization:
        raise ResourceNotFound()

    if not await authz.can(auth_subject.subject, AccessType.write, organization):
        raise Unauthorized()

    updated = await license_key_service.update(session, license_key=lk, updates=updates)
    return updated
