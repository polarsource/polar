from fastapi import Depends

from polar.exceptions import NotPermitted
from polar.kit.db.postgres import AsyncSession
from polar.license_key.schemas import (
    LicenseKeyActivate,
    LicenseKeyActivationBase,
    LicenseKeyActivationRead,
    LicenseKeyDeactivate,
    LicenseKeyValidate,
    NotFoundResponse,
    ValidatedLicenseKey,
)
from polar.license_key.service import license_key as license_key_service
from polar.models import LicenseKeyActivation
from polar.openapi import APITag
from polar.postgres import get_db_session
from polar.routing import APIRouter

router = APIRouter(prefix="/license-keys", tags=[APITag.documented, APITag.featured])


ActivationNotPermitted = {
    "description": "License key activation not required or permitted (limit reached).",
    "model": NotPermitted.schema(),
}


@router.post(
    "/validate",
    response_model=ValidatedLicenseKey,
    responses={
        404: NotFoundResponse,
    },
)
async def validate(
    validate: LicenseKeyValidate,
    session: AsyncSession = Depends(get_db_session),
) -> ValidatedLicenseKey:
    """Validate a license key."""
    lk = await license_key_service.get_or_raise_by_key(session, key=validate.key)
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
        403: ActivationNotPermitted,
        404: NotFoundResponse,
    },
)
async def activate(
    activate: LicenseKeyActivate,
    session: AsyncSession = Depends(get_db_session),
) -> LicenseKeyActivation:
    """Activate a license key instance."""
    lk = await license_key_service.get_or_raise_by_key(session, key=activate.key)
    return await license_key_service.activate(
        session, license_key=lk, activate=activate
    )


@router.post(
    "/deactivate",
    summary="Deactivate license key activation",
    status_code=204,
    responses={
        204: {"description": "License key activation deactivated."},
        404: NotFoundResponse,
    },
)
async def deactivate(
    deactivate: LicenseKeyDeactivate,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    """Deactivate a license key instance."""
    lk = await license_key_service.get_or_raise_by_key(session, key=deactivate.key)
    await license_key_service.deactivate(session, license_key=lk, deactivate=deactivate)
