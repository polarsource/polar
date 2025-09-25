from fastapi import Depends, Query
from pydantic import UUID4

from polar.benefit.schemas import BenefitID
from polar.exceptions import ResourceNotFound
from polar.kit.db.postgres import AsyncReadSession, AsyncSession
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.schemas import MultipleQueryFilter
from polar.models import LicenseKey, LicenseKeyActivation
from polar.openapi import APITag
from polar.organization.schemas import OrganizationID
from polar.postgres import get_db_read_session, get_db_session
from polar.routing import APIRouter

from . import auth
from .repository import LicenseKeyRepository
from .schemas import (
    ActivationNotPermitted,
    LicenseKeyActivate,
    LicenseKeyActivationRead,
    LicenseKeyDeactivate,
    LicenseKeyRead,
    LicenseKeyUpdate,
    LicenseKeyValidate,
    LicenseKeyWithActivations,
    NotFoundResponse,
    UnauthorizedResponse,
    ValidatedLicenseKey,
)
from .service import license_key as license_key_service

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
    auth_subject: auth.LicenseKeysRead,
    pagination: PaginationParamsQuery,
    organization_id: MultipleQueryFilter[OrganizationID] | None = Query(
        None, title="OrganizationID Filter", description="Filter by organization ID."
    ),
    benefit_id: MultipleQueryFilter[BenefitID] | None = Query(
        None, title="BenefitID Filter", description="Filter by benefit ID."
    ),
    session: AsyncReadSession = Depends(get_db_read_session),
) -> ListResource[LicenseKeyRead]:
    """Get license keys connected to the given organization & filters."""
    results, count = await license_key_service.list(
        session,
        auth_subject,
        organization_id=organization_id,
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
    responses={
        401: UnauthorizedResponse,
        404: NotFoundResponse,
    },
)
async def get(
    auth_subject: auth.LicenseKeysRead,
    id: UUID4,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> LicenseKey:
    """Get a license key."""
    lk = await license_key_service.get(session, auth_subject, id)
    if not lk:
        raise ResourceNotFound()

    return lk


@router.patch(
    "/{id}",
    summary="Update License Key",
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
) -> LicenseKey:
    """Update a license key."""
    lk = await license_key_service.get(session, auth_subject, id)
    if not lk:
        raise ResourceNotFound()

    updated = await license_key_service.update(session, license_key=lk, updates=updates)
    return updated


@router.get(
    "/{id}/activations/{activation_id}",
    summary="Get Activation",
    response_model=LicenseKeyActivationRead,
    responses={
        401: UnauthorizedResponse,
        404: NotFoundResponse,
    },
)
async def get_activation(
    auth_subject: auth.LicenseKeysRead,
    id: UUID4,
    activation_id: UUID4,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> LicenseKeyActivation:
    """Get a license key activation."""
    lk = await license_key_service.get(session, auth_subject, id)
    if not lk:
        raise ResourceNotFound()

    activation = await license_key_service.get_activation_or_raise(
        session,
        license_key=lk,
        activation_id=activation_id,
    )
    return activation


@router.post(
    "/validate",
    summary="Validate License Key",
    response_model=ValidatedLicenseKey,
    responses={
        404: NotFoundResponse,
    },
)
async def validate(
    auth_subject: auth.LicenseKeysWrite,
    validate: LicenseKeyValidate,
    session: AsyncSession = Depends(get_db_session),
) -> LicenseKey:
    """Validate a license key."""
    repository = LicenseKeyRepository.from_session(session)
    license_key = await repository.get_readable_by_key(
        validate.key,
        validate.organization_id,
        auth_subject,
        options=repository.get_eager_options(),
    )

    if license_key is None:
        raise ResourceNotFound()

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
    auth_subject: auth.LicenseKeysWrite,
    activate: LicenseKeyActivate,
    session: AsyncSession = Depends(get_db_session),
) -> LicenseKeyActivation:
    """Activate a license key instance."""
    repository = LicenseKeyRepository.from_session(session)
    license_key = await repository.get_readable_by_key(
        activate.key,
        activate.organization_id,
        auth_subject,
        options=repository.get_eager_options(),
    )

    if license_key is None:
        raise ResourceNotFound()

    return await license_key_service.activate(
        session, license_key=license_key, activate=activate
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
    auth_subject: auth.LicenseKeysWrite,
    deactivate: LicenseKeyDeactivate,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    """Deactivate a license key instance."""
    repository = LicenseKeyRepository.from_session(session)
    license_key = await repository.get_readable_by_key(
        deactivate.key,
        deactivate.organization_id,
        auth_subject,
        options=repository.get_eager_options(),
    )

    if license_key is None:
        raise ResourceNotFound()

    await license_key_service.deactivate(
        session, license_key=license_key, deactivate=deactivate
    )
