from typing import Annotated

from fastapi import Depends, Path
from pydantic import (
    UUID4,
)

from polar.authz.service import AccessType, Authz
from polar.exceptions import NotPermitted, ResourceNotFound, Unauthorized
from polar.kit.db.postgres import AsyncSession
from polar.models import LicenseKey, LicenseKeyActivation
from polar.openapi import APITag
from polar.postgres import get_db_session
from polar.routing import APIRouter

from .. import auth
from ..schemas.license_key import (
    LicenseKeyActivate,
    LicenseKeyActivationRead,
    LicenseKeyRead,
    LicenseKeyValidate,
)
from ..service.license_key import license_key as license_key_service

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

###############################################################################
# CRUD
###############################################################################


@router.get(
    "/{id}",
    response_model=LicenseKeyRead,
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

    if not await authz.can(auth_subject.subject, AccessType.read, lk):
        raise Unauthorized()

    return lk


###############################################################################
# ACTIVATION & VALIDATION
###############################################################################


@router.post(
    "/validate",
    response_model=LicenseKeyRead,
    responses={
        401: NotAuthorized,
        404: LicenseKeyNotFound,
    },
)
async def validate(
    auth_subject: auth.LicenseKeysWrite,
    validate: LicenseKeyValidate,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> LicenseKey:
    """Validate a license key."""
    lk = await license_key_service.get_or_raise_by_key(session, key=validate.key)
    if not await authz.can(auth_subject.subject, AccessType.write, lk):
        raise Unauthorized()

    return await license_key_service.validate(
        session,
        license_key=lk,
        validate=validate,
    )


@router.post(
    "/activate",
    response_model=LicenseKeyActivationRead,
    responses={
        401: NotAuthorized,
        403: ActivationNotPermitted,
        404: LicenseKeyNotFound,
    },
)
async def activate(
    auth_subject: auth.LicenseKeysWrite,
    activate: LicenseKeyActivate,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> LicenseKeyActivation:
    """Activate a license key instance."""
    lk = await license_key_service.get_or_raise_by_key(session, key=activate.key)
    if not await authz.can(auth_subject.subject, AccessType.write, lk):
        raise Unauthorized()

    return await license_key_service.activate(
        session, license_key=lk, activate=activate
    )
