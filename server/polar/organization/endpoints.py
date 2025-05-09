from fastapi import Depends, Query

from polar.account.schemas import Account as AccountSchema
from polar.account.service import account as account_service
from polar.exceptions import NotPermitted, ResourceNotFound
from polar.kit.pagination import ListResource, Pagination, PaginationParamsQuery
from polar.models import Account, Organization
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter
from polar.user_organization.schemas import OrganizationMember
from polar.user_organization.service import (
    user_organization as user_organization_service,
)

from . import auth, sorting
from .schemas import Organization as OrganizationSchema
from .schemas import (
    OrganizationCreate,
    OrganizationID,
    OrganizationSetAccount,
    OrganizationUpdate,
)
from .service import organization as organization_service

router = APIRouter(prefix="/organizations", tags=["organizations"])

OrganizationNotFound = {
    "description": "Organization not found.",
    "model": ResourceNotFound.schema(),
}


@router.get(
    "/",
    summary="List Organizations",
    response_model=ListResource[OrganizationSchema],
    tags=[APITag.documented, APITag.featured],
)
async def list(
    auth_subject: auth.OrganizationsRead,
    pagination: PaginationParamsQuery,
    sorting: sorting.ListSorting,
    slug: str | None = Query(None, description="Filter by slug."),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[OrganizationSchema]:
    """List organizations."""
    results, count = await organization_service.list(
        session,
        auth_subject,
        slug=slug,
        pagination=pagination,
        sorting=sorting,
    )

    return ListResource.from_paginated_results(
        [OrganizationSchema.model_validate(result) for result in results],
        count,
        pagination,
    )


@router.get(
    "/{id}",
    summary="Get Organization",
    response_model=OrganizationSchema,
    responses={404: OrganizationNotFound},
    tags=[APITag.documented, APITag.featured],
)
async def get(
    id: OrganizationID,
    auth_subject: auth.OrganizationsRead,
    session: AsyncSession = Depends(get_db_session),
) -> Organization:
    """Get an organization by ID."""
    organization = await organization_service.get(session, auth_subject, id)

    if organization is None:
        raise ResourceNotFound()

    return organization


@router.post(
    "/",
    response_model=OrganizationSchema,
    status_code=201,
    summary="Create Organization",
    responses={201: {"description": "Organization created."}},
    tags=[APITag.documented, APITag.featured],
)
async def create(
    organization_create: OrganizationCreate,
    auth_subject: auth.OrganizationsCreate,
    session: AsyncSession = Depends(get_db_session),
) -> Organization:
    """Create an organization."""
    return await organization_service.create(session, organization_create, auth_subject)


@router.patch(
    "/{id}",
    response_model=OrganizationSchema,
    summary="Update Organization",
    responses={
        200: {"description": "Organization updated."},
        403: {
            "description": "You don't have the permission to update this organization.",
            "model": NotPermitted.schema(),
        },
        404: OrganizationNotFound,
    },
    tags=[APITag.documented, APITag.featured],
)
async def update(
    id: OrganizationID,
    organization_update: OrganizationUpdate,
    auth_subject: auth.OrganizationsWrite,
    session: AsyncSession = Depends(get_db_session),
) -> Organization:
    """Update an organization."""
    organization = await organization_service.get(session, auth_subject, id)

    if organization is None:
        raise ResourceNotFound()

    return await organization_service.update(session, organization, organization_update)


@router.get(
    "/{id}/account",
    response_model=AccountSchema,
    summary="Get Organization Account",
    responses={
        404: {
            "description": "Organization not found or account not set.",
            "model": ResourceNotFound.schema(),
        },
    },
    tags=[APITag.private],
)
async def get_account(
    id: OrganizationID,
    auth_subject: auth.OrganizationsWrite,
    session: AsyncSession = Depends(get_db_session),
) -> Account:
    """Get the account for an organization."""
    organization = await organization_service.get(session, auth_subject, id)

    if organization is None:
        raise ResourceNotFound()

    if organization.account_id is None:
        raise ResourceNotFound()

    account = await account_service.get(session, auth_subject, organization.account_id)

    if account is None:
        raise ResourceNotFound()

    return account


@router.patch(
    "/{id}/account",
    response_model=OrganizationSchema,
    summary="Set Organization Account",
    responses={
        200: {"description": "Organization account set."},
        403: {
            "description": "You don't have the permission to update this organization.",
            "model": NotPermitted.schema(),
        },
        404: OrganizationNotFound,
    },
    tags=[APITag.private],
)
async def set_account(
    id: OrganizationID,
    set_account: OrganizationSetAccount,
    auth_subject: auth.OrganizationsWrite,
    session: AsyncSession = Depends(get_db_session),
) -> Organization:
    """Set the account for an organization."""
    organization = await organization_service.get(session, auth_subject, id)

    if organization is None:
        raise ResourceNotFound()

    return await organization_service.set_account(
        session, auth_subject, organization, set_account.account_id
    )


@router.get(
    "/{id}/members",
    response_model=ListResource[OrganizationMember],
    tags=[APITag.private],
)
async def members(
    id: OrganizationID,
    auth_subject: auth.OrganizationsWrite,
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[OrganizationMember]:
    """List members in an organization."""
    organization = await organization_service.get(session, auth_subject, id)

    if organization is None:
        raise ResourceNotFound()

    members = await user_organization_service.list_by_org(session, id)

    return ListResource(
        items=[OrganizationMember.model_validate(m) for m in members],
        pagination=Pagination(total_count=len(members), max_page=1),
    )
