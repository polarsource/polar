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
from polar.organization.service import organization as organization_service
from polar.postgres import get_db_session
from polar.routing import APIRouter

from .. import auth
from ..schemas.license_key import (
    LicenseKeyActivate,
    LicenseKeyActivationBase,
    LicenseKeyActivationRead,
    LicenseKeyDeactivate,
    LicenseKeyRead,
    LicenseKeyUpdate,
    LicenseKeyValidate,
    LicenseKeyWithActivations,
    ValidatedLicenseKey,
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
# LICENSE KEY CRUD
###############################################################################


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


###############################################################################
# ACTIVATION & VALIDATION
###############################################################################


@router.post(
    "/validate",
    response_model=ValidatedLicenseKey,
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
) -> ValidatedLicenseKey:
    """Validate a license key."""
    lk = await license_key_service.get_or_raise_by_key(session, key=validate.key)
    if not await authz.can(auth_subject.subject, AccessType.write, lk):
        raise Unauthorized()

    license_key, activation = await license_key_service.validate(
        session,
        license_key=lk,
        validate=validate,
    )
    if activation:
        activation = LicenseKeyActivationBase(
            id=activation.id,
            license_key_id=activation.license_key_id,
            label=activation.label,
            meta=activation.meta,
        )

    return ValidatedLicenseKey(
        id=license_key.id,
        user_id=license_key.user_id,
        benefit_id=license_key.benefit_id,
        key=license_key.key,
        status=license_key.status,
        usage=license_key.usage,
        limit_usage=license_key.limit_usage,
        limit_activations=license_key.limit_activations,
        activation=activation,
        expires_at=license_key.expires_at,
        validations=license_key.validations,
        last_validated_at=license_key.last_validated_at,
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


@router.post(
    "/deactivate",
    summary="Deactivate license key activation",
    status_code=204,
    responses={
        204: {"description": "License key activation deactivated."},
        401: NotAuthorized,
        404: LicenseKeyNotFound,
    },
)
async def deactivate(
    auth_subject: auth.LicenseKeysWrite,
    deactivate: LicenseKeyDeactivate,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> None:
    """Deactivate a license key instance."""
    lk = await license_key_service.get_or_raise_by_key(session, key=deactivate.key)
    if not await authz.can(auth_subject.subject, AccessType.write, lk):
        raise Unauthorized()

    await license_key_service.deactivate(session, license_key=lk, deactivate=deactivate)
