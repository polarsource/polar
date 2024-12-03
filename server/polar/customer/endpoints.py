from typing import Annotated

from fastapi import Depends, Path, Query
from pydantic import UUID4

from polar.authz.service import Authz
from polar.exceptions import ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.schemas import MultipleQueryFilter
from polar.models import Customer
from polar.openapi import APITag
from polar.organization.schemas import OrganizationID
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from . import auth, sorting
from .schemas import Customer as CustomerSchema
from .schemas import CustomerCreate, CustomerUpdate
from .service import customer as customer_service

router = APIRouter(
    prefix="/customers", tags=["customers", APITag.documented, APITag.featured]
)


CustomerID = Annotated[UUID4, Path(description="The customer ID.")]
CustomerNotFound = {
    "description": "Customer not found.",
    "model": ResourceNotFound.schema(),
}


@router.get("/", summary="List Customers", response_model=ListResource[CustomerSchema])
async def list(
    auth_subject: auth.CustomerRead,
    pagination: PaginationParamsQuery,
    sorting: sorting.ListSorting,
    organization_id: MultipleQueryFilter[OrganizationID] | None = Query(
        None, title="OrganizationID Filter", description="Filter by organization ID."
    ),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[CustomerSchema]:
    """List customers."""
    results, count = await customer_service.list(
        session,
        auth_subject,
        organization_id=organization_id,
        pagination=pagination,
        sorting=sorting,
    )

    return ListResource.from_paginated_results(
        [CustomerSchema.model_validate(result) for result in results],
        count,
        pagination,
    )


@router.get(
    "/{id}",
    summary="Get Customer",
    response_model=CustomerSchema,
    responses={404: CustomerNotFound},
)
async def get(
    id: CustomerID,
    auth_subject: auth.CustomerRead,
    session: AsyncSession = Depends(get_db_session),
) -> Customer:
    """Get a customer by ID."""
    customer = await customer_service.get_by_id(session, auth_subject, id)

    if customer is None:
        raise ResourceNotFound()

    return customer


@router.post(
    "/",
    response_model=CustomerSchema,
    status_code=201,
    summary="Create Customer",
    responses={201: {"description": "Customer created."}},
)
async def create(
    customer_create: CustomerCreate,
    auth_subject: auth.CustomerWrite,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> Customer:
    """Create a customer."""
    return await customer_service.create(session, authz, customer_create, auth_subject)


@router.patch(
    "/{id}",
    response_model=CustomerSchema,
    summary="Update Customer",
    responses={
        200: {"description": "Customer updated."},
        404: CustomerNotFound,
    },
)
async def update(
    id: CustomerID,
    customer_update: CustomerUpdate,
    auth_subject: auth.CustomerWrite,
    session: AsyncSession = Depends(get_db_session),
) -> Customer:
    """Update a customer."""
    customer = await customer_service.get_by_id(session, auth_subject, id)

    if customer is None:
        raise ResourceNotFound()

    return await customer_service.update(session, customer, customer_update)


@router.delete(
    "/{id}",
    status_code=204,
    summary="Delete Customer",
    responses={
        204: {"description": "Customer deleted."},
        404: CustomerNotFound,
    },
)
async def delete(
    id: CustomerID,
    auth_subject: auth.CustomerWrite,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    """
    Delete a customer.

    Immediately cancels any active subscriptions and revokes any active benefits.
    """
    customer = await customer_service.get_by_id(session, auth_subject, id)

    if customer is None:
        raise ResourceNotFound()

    await customer_service.delete(session, customer)
