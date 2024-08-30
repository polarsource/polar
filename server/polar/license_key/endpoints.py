from fastapi import Depends, Query
from pydantic import UUID4

from polar.authz.service import AccessType, Authz
from polar.exceptions import ResourceNotFound, Unauthorized
from polar.kit.db.postgres import AsyncSession
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.schemas import MultipleQueryFilter
from polar.models import LicenseKey, LicenseKeyActivation
from polar.openapi import APITag
from polar.organization.schemas import OrganizationID
from polar.postgres import get_db_session
from polar.routing import APIRouter

from . import auth
from .schemas import (
    LicenseKeyActivationRead,
    LicenseKeyRead,
    LicenseKeyUpdate,
    LicenseKeyWithActivations,
    NotFoundResponse,
    UnauthorizedResponse,
)
from .service import license_key as license_key_service

router = APIRouter(
    prefix="/license-keys", tags=["license_keys", APITag.documented, APITag.featured]
)

###############################################################################
# LICENSE KEYS
###############################################################################


@router.get(
    "",
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
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[LicenseKeyRead]:
    """Get license keys connected to the given organization & filters."""
    results, count = await license_key_service.get_list(
        session,
        auth_subject,
        organization_ids=organization_id,
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


###############################################################################
# LICENSE KEY ACTIVATIONS
###############################################################################


@router.get(
    "/{id}/activations/{activation_id}",
    summary="Get License Key Activation",
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
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> LicenseKeyActivation:
    """Get a license key activation."""
    lk = await license_key_service.get_by_id(session, id)
    if not lk:
        raise ResourceNotFound()

    if not await authz.can(auth_subject.subject, AccessType.read, lk):
        raise Unauthorized()

    activation = await license_key_service.get_activation_or_raise(
        session,
        license_key=lk,
        activation_id=activation_id,
    )
    return activation
