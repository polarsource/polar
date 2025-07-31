from typing import cast

from fastapi import Depends, Query
from pydantic import UUID4

from polar.benefit.schemas import BenefitID
from polar.benefit.strategies.license_keys.properties import (
    BenefitLicenseKeysProperties,
)
from polar.exceptions import NotPermitted, ResourceNotFound
from polar.kit.db.postgres import AsyncSession
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.schemas import MultipleQueryFilter
from polar.license_key.schemas import (
    LicenseKeyActivate,
    LicenseKeyActivationBase,
    LicenseKeyActivationRead,
    LicenseKeyDeactivate,
    LicenseKeyRead,
    LicenseKeyValidate,
    LicenseKeyWithActivations,
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

router = APIRouter(
    prefix="/license-keys", tags=["license_keys", APITag.documented, APITag.featured]
)


ActivationNotPermitted = {
    "description": "License key activation not supported or limit reached. Use /validate endpoint for licenses without activations.",
    "model": NotPermitted.schema(),
}


@router.get(
    "/",
    summary="List License Keys",
    response_model=ListResource[LicenseKeyRead],
    responses={
        401: UnauthorizedResponse,
        404: NotFoundResponse,
    },
)
async def list(
    auth_subject: auth.CustomerPortalRead,
    pagination: PaginationParamsQuery,
    organization_id: MultipleQueryFilter[OrganizationID] | None = Query(
        None, title="OrganizationID Filter", description="Filter by organization ID."
    ),
    benefit_id: BenefitID | None = Query(
        None, description="Filter by a specific benefit"
    ),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[LicenseKeyRead]:
    results, count = await license_key_service.get_customer_list(
        session,
        auth_subject,
        organization_ids=organization_id,
        benefit_id=benefit_id,
        pagination=pagination,
    )

    return ListResource.from_paginated_results(
        [LicenseKeyRead.model_validate(result) for result in results],
        count,
        pagination,
    )


@router.get(
    "/{id}",
    summary="Get License Key",
    response_model=LicenseKeyWithActivations,
    responses={404: NotFoundResponse},
)
async def get(
    auth_subject: auth.CustomerPortalRead,
    id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> LicenseKeyWithActivations:
    """Get a license key."""
    lk = await license_key_service.get_customer_license_key(session, auth_subject, id)
    if not lk:
        raise ResourceNotFound()

    ret = LicenseKeyWithActivations.model_validate(lk)
    properties = cast(BenefitLicenseKeysProperties, lk.benefit.properties)
    activations = properties.get("activations")
    if not (activations and activations.get("enable_customer_admin")):
        ret.activations = []

    return ret


@router.post(
    "/validate",
    summary="Validate License Key",
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
    lk = await license_key_service.get_or_raise_by_key(
        session,
        organization_id=validate.organization_id,
        key=validate.key,
    )
    license_key, activation = await license_key_service.validate(
        session,
        license_key=lk,
        validate=validate,
    )
    activation_schema = None
    if activation:
        activation_schema = LicenseKeyActivationBase.model_validate(activation)

    ret = ValidatedLicenseKey.model_validate(license_key)
    ret.activation = activation_schema
    return ret


@router.post(
    "/activate",
    summary="Activate License Key",
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
    lk = await license_key_service.get_or_raise_by_key(
        session,
        organization_id=activate.organization_id,
        key=activate.key,
    )
    return await license_key_service.activate(
        session, license_key=lk, activate=activate
    )


@router.post(
    "/deactivate",
    summary="Deactivate License Key",
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
    lk = await license_key_service.get_or_raise_by_key(
        session,
        organization_id=deactivate.organization_id,
        key=deactivate.key,
    )
    await license_key_service.deactivate(session, license_key=lk, deactivate=deactivate)
