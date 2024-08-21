from fastapi import Depends, Query

from polar.benefit.schemas import BenefitID
from polar.exceptions import NotPermitted
from polar.kit.db.postgres import AsyncSession
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.license_key.schemas import (
    LicenseKeyActivate,
    LicenseKeyActivationBase,
    LicenseKeyActivationRead,
    LicenseKeyDeactivate,
    LicenseKeyRead,
    LicenseKeyValidate,
    NotFoundResponse,
    UnauthorizedResponse,
    ValidatedLicenseKey,
)
from polar.license_key.service import license_key as license_key_service
from polar.models import LicenseKeyActivation
from polar.openapi import APITag
from polar.organization.schemas import OrganizationID
from polar.postgres import get_db_session
from polar.routing import APIRouter

from .. import auth

router = APIRouter(prefix="/license-keys", tags=[APITag.documented, APITag.featured])


ActivationNotPermitted = {
    "description": "License key activation not required or permitted (limit reached).",
    "model": NotPermitted.schema(),
}


@router.get(
    "",
    response_model=ListResource[LicenseKeyRead],
    responses={
        401: UnauthorizedResponse,
        404: NotFoundResponse,
    },
)
async def list_license_keys(
    auth_subject: auth.UserLicenseKeysRead,
    pagination: PaginationParamsQuery,
    organization_id: OrganizationID,
    benefit_id: BenefitID | None = Query(
        None, description="Filter by a specific benefit"
    ),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[LicenseKeyRead]:
    results, count = await license_key_service.get_user_list(
        session,
        user=auth_subject.subject,
        organization_id=organization_id,
        benefit_id=benefit_id,
        pagination=pagination,
    )

    return ListResource.from_paginated_results(
        [LicenseKeyRead.model_validate(result) for result in results],
        count,
        pagination,
    )


@router.post(
    "/validate",
    response_model=ValidatedLicenseKey,
    responses={
        404: NotFoundResponse,
    },
)
async def validate_license_key(
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
async def activate_license_key(
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
async def deactivate_license_key(
    deactivate: LicenseKeyDeactivate,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    """Deactivate a license key instance."""
    lk = await license_key_service.get_or_raise_by_key(session, key=deactivate.key)
    await license_key_service.deactivate(session, license_key=lk, deactivate=deactivate)
