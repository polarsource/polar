from typing import cast

from fastapi import Depends, Query
from pydantic import UUID4

from polar.benefit.schemas import BenefitID
from polar.benefit.strategies.license_keys.properties import (
    BenefitLicenseKeysProperties,
)
from polar.exceptions import ResourceNotFound
from polar.kit.db.postgres import AsyncSession
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.license_key.schemas import (
    ActivationNotPermitted,
    LicenseKeyActivate,
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
from polar.models import LicenseKey, LicenseKeyActivation
from polar.openapi import APITag
from polar.postgres import get_db_session
from polar.routing import APIRouter

from .. import auth

router = APIRouter(prefix="/license-keys", tags=["license_keys", APITag.public])


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
    benefit_id: BenefitID | None = Query(
        None, description="Filter by a specific benefit"
    ),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[LicenseKeyRead]:
    results, count = await license_key_service.get_customer_list(
        session,
        auth_subject,
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
) -> LicenseKey:
    """
     Validate a license key.

    > This endpoint doesn't require authentication and can be safely used on a public
    > client, like a desktop application or a mobile app.
    > If you plan to validate a license key on a server, use the `/v1/license-keys/validate`
    > endpoint instead.
    """
    license_key = await license_key_service.get_or_raise_by_key(
        session,
        organization_id=validate.organization_id,
        key=validate.key,
    )
    return await license_key_service.validate(
        session, license_key=license_key, validate=validate
    )


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
    """
    Activate a license key instance.

    > This endpoint doesn't require authentication and can be safely used on a public
    > client, like a desktop application or a mobile app.
    > If you plan to validate a license key on a server, use the `/v1/license-keys/activate`
    > endpoint instead.
    """
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
    """
    Deactivate a license key instance.

    > This endpoint doesn't require authentication and can be safely used on a public
    > client, like a desktop application or a mobile app.
    > If you plan to validate a license key on a server, use the `/v1/license-keys/deactivate`
    > endpoint instead.
    """
    lk = await license_key_service.get_or_raise_by_key(
        session,
        organization_id=deactivate.organization_id,
        key=deactivate.key,
    )
    await license_key_service.deactivate(session, license_key=lk, deactivate=deactivate)
