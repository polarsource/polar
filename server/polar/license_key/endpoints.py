from fastapi import Depends
from pydantic import UUID4

from polar.authz.service import AccessType, Authz
from polar.exceptions import ResourceNotFound, Unauthorized
from polar.kit.db.postgres import AsyncSession
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.models import LicenseKey, LicenseKeyActivation
from polar.openapi import APITag
from polar.organization.service import organization as organization_service
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

router = APIRouter(prefix="/license-keys", tags=[APITag.documented, APITag.featured])

###############################################################################
# LICENSE KEYS
###############################################################################


@router.get(
    "",
    response_model=ListResource[LicenseKeyRead],
    responses={
        401: UnauthorizedResponse,
        404: NotFoundResponse,
    },
)
async def list(
    auth_subject: auth.LicenseKeysRead,
    pagination: PaginationParamsQuery,
    organization_id: UUID4,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> ListResource[LicenseKeyRead]:
    """Get license keys connected to the given organization & filters."""
    organization = await organization_service.get(session, organization_id)
    if not organization:
        raise ResourceNotFound()

    if not await authz.can(auth_subject.subject, AccessType.read, organization):
        raise Unauthorized()

    results, count = await license_key_service.get_list(
        session,
        organization_id=organization_id,
        pagination=pagination,
    )

    return ListResource.from_paginated_results(
        [LicenseKeyRead.model_validate(result) for result in results],
        count,
        pagination,
    )


@router.get(
    "/{id}",
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
