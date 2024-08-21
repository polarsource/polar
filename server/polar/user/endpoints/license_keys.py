from typing import Annotated

from fastapi import Depends, Path

from polar.authz.service import AccessType, Authz
from polar.exceptions import NotPermitted, ResourceNotFound, Unauthorized
from polar.kit.db.postgres import AsyncSession
from polar.license_key import auth
from polar.license_key.schemas import (
    LicenseKeyActivate,
    LicenseKeyActivationBase,
    LicenseKeyActivationRead,
    LicenseKeyDeactivate,
    LicenseKeyValidate,
    ValidatedLicenseKey,
)
from polar.license_key.service import license_key as license_key_service
from polar.models import LicenseKeyActivation
from polar.openapi import APITag
from polar.postgres import get_db_session
from polar.routing import APIRouter

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
