import json
from collections.abc import AsyncGenerator

from fastapi import Depends, Query, Response
from fastapi.responses import StreamingResponse

from polar.exceptions import ResourceNotFound
from polar.kit.csv import IterableCSVWriter
from polar.kit.metadata import MetadataQuery, get_metadata_query_openapi_schema
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.schemas import MultipleQueryFilter
from polar.models import Customer
from polar.openapi import APITag
from polar.organization.schemas import OrganizationID
from polar.postgres import (
    AsyncReadSession,
    AsyncSession,
    get_db_read_session,
    get_db_session,
)
from polar.redis import Redis, get_redis
from polar.routing import APIRouter

from . import auth, sorting
from .repository import CustomerRepository
from .schemas.customer import Customer as CustomerSchema
from .schemas.customer import (
    CustomerCreate,
    CustomerID,
    CustomerUpdate,
    CustomerUpdateExternalID,
    ExternalCustomerID,
)
from .schemas.state import CustomerState
from .service import customer as customer_service

router = APIRouter(
    prefix="/customers",
    tags=["customers", APITag.public, APITag.mcp],
)


CustomerNotFound = {
    "description": "Customer not found.",
    "model": ResourceNotFound.schema(),
}


@router.get(
    "/",
    summary="List Customers",
    response_model=ListResource[CustomerSchema],
    openapi_extra={"parameters": [get_metadata_query_openapi_schema()]},
)
async def list(
    auth_subject: auth.CustomerRead,
    pagination: PaginationParamsQuery,
    sorting: sorting.ListSorting,
    metadata: MetadataQuery,
    organization_id: MultipleQueryFilter[OrganizationID] | None = Query(
        None, title="OrganizationID Filter", description="Filter by organization ID."
    ),
    email: str | None = Query(None, description="Filter by exact email."),
    query: str | None = Query(
        None, description="Filter by name, email, or external ID."
    ),
    session: AsyncReadSession = Depends(get_db_read_session),
) -> ListResource[CustomerSchema]:
    """List customers."""
    results, count = await customer_service.list(
        session,
        auth_subject,
        organization_id=organization_id,
        email=email,
        metadata=metadata,
        query=query,
        pagination=pagination,
        sorting=sorting,
    )

    return ListResource.from_paginated_results(
        [CustomerSchema.model_validate(result) for result in results], count, pagination
    )


@router.get(
    "/export",
    summary="Export Customers",
    responses={
        200: {
            "content": {"text/csv": {"schema": {"type": "string"}}},
        },
    },
)
async def export(
    auth_subject: auth.CustomerRead,
    organization_id: MultipleQueryFilter[OrganizationID] | None = Query(
        None, description="Filter by organization ID."
    ),
    session: AsyncReadSession = Depends(get_db_read_session),
) -> Response:
    """Export customers as a CSV file."""

    async def create_csv() -> AsyncGenerator[str, None]:
        csv_writer = IterableCSVWriter(dialect="excel")

        yield csv_writer.getrow(
            (
                "ID",
                "External ID",
                "Created At",
                "Email",
                "Name",
                "Tax ID",
                "Billing Address Line 1",
                "Billing Address Line 2",
                "Billing Address City",
                "Billing Address State",
                "Billing Address Zip",
                "Billing Address Country",
                "Metadata",
            )
        )

        repository = CustomerRepository.from_session(session)
        stream = repository.stream_by_organization(auth_subject, organization_id)

        async for customer in stream:
            billing_address = customer.billing_address

            yield csv_writer.getrow(
                (
                    customer.id,
                    customer.external_id,
                    customer.created_at.isoformat(),
                    customer.email,
                    customer.name,
                    customer.tax_id,
                    billing_address.line1 if billing_address else None,
                    billing_address.line2 if billing_address else None,
                    billing_address.city if billing_address else None,
                    billing_address.state if billing_address else None,
                    billing_address.postal_code if billing_address else None,
                    billing_address.country if billing_address else None,
                    json.dumps(customer.user_metadata)
                    if customer.user_metadata
                    else None,
                )
            )

    filename = "polar-customers.csv"
    return StreamingResponse(
        create_csv(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
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
    session: AsyncReadSession = Depends(get_db_read_session),
) -> Customer:
    """Get a customer by ID."""
    customer = await customer_service.get(session, auth_subject, id)

    if customer is None:
        raise ResourceNotFound()

    return customer


@router.get(
    "/external/{external_id}",
    summary="Get Customer by External ID",
    response_model=CustomerSchema,
    responses={404: CustomerNotFound},
)
async def get_external(
    external_id: ExternalCustomerID,
    auth_subject: auth.CustomerRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> Customer:
    """Get a customer by external ID."""
    customer = await customer_service.get_external(session, auth_subject, external_id)

    if customer is None:
        raise ResourceNotFound()

    return customer


@router.get(
    "/{id}/state",
    summary="Get Customer State",
    response_model=CustomerState,
    responses={404: CustomerNotFound},
)
async def get_state(
    id: CustomerID,
    auth_subject: auth.CustomerRead,
    session: AsyncReadSession = Depends(get_db_read_session),
    redis: Redis = Depends(get_redis),
) -> CustomerState:
    """
    Get a customer state by ID.

    The customer state includes information about
    the customer's active subscriptions and benefits.

    It's the ideal endpoint to use when you need to get a full overview
    of a customer's status.
    """
    customer = await customer_service.get(session, auth_subject, id)

    if customer is None:
        raise ResourceNotFound()

    return await customer_service.get_state(session, redis, customer)


@router.get(
    "/external/{external_id}/state",
    summary="Get Customer State by External ID",
    response_model=CustomerState,
    responses={404: CustomerNotFound},
)
async def get_state_external(
    external_id: ExternalCustomerID,
    auth_subject: auth.CustomerRead,
    session: AsyncReadSession = Depends(get_db_read_session),
    redis: Redis = Depends(get_redis),
) -> CustomerState:
    """
    Get a customer state by external ID.

    The customer state includes information about
    the customer's active subscriptions and benefits.

    It's the ideal endpoint to use when you need to get a full overview
    of a customer's status.
    """
    customer = await customer_service.get_external(session, auth_subject, external_id)

    if customer is None:
        raise ResourceNotFound()

    return await customer_service.get_state(session, redis, customer)


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
) -> Customer:
    """Create a customer."""
    return await customer_service.create(session, customer_create, auth_subject)


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
    customer = await customer_service.get(session, auth_subject, id)

    if customer is None:
        raise ResourceNotFound()

    return await customer_service.update(session, customer, customer_update)


@router.patch(
    "/external/{external_id}",
    response_model=CustomerSchema,
    summary="Update Customer by External ID",
    responses={
        200: {"description": "Customer updated."},
        404: CustomerNotFound,
    },
)
async def update_external(
    external_id: ExternalCustomerID,
    customer_update: CustomerUpdateExternalID,
    auth_subject: auth.CustomerWrite,
    session: AsyncSession = Depends(get_db_session),
) -> Customer:
    """Update a customer by external ID."""
    customer = await customer_service.get_external(session, auth_subject, external_id)

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
    anonymize: bool = Query(
        default=False,
        description=(
            "If true, also anonymize the customer's personal data for GDPR compliance. "
            "This replaces email with a hashed version, hashes name and billing name "
            "(name preserved for businesses with tax_id), clears billing address, "
            "and removes OAuth account data."
        ),
    ),
    session: AsyncSession = Depends(get_db_session),
) -> None:
    """
    Delete a customer.

    This action cannot be undone and will immediately:
    - Cancel any active subscriptions for the customer
    - Revoke all their benefits
    - Clear any `external_id`

    Use it only in the context of deleting a user within your
    own service. Otherwise, use more granular API endpoints to cancel
    a specific subscription or revoke certain benefits.

    Note: The customers information will nonetheless be retained for historic
    orders and subscriptions.

    Set `anonymize=true` to also anonymize PII for GDPR compliance.
    """
    customer = await customer_service.get(session, auth_subject, id)

    if customer is None:
        raise ResourceNotFound()

    await customer_service.delete(session, customer, anonymize=anonymize)


@router.delete(
    "/external/{external_id}",
    status_code=204,
    summary="Delete Customer by External ID",
    responses={
        204: {"description": "Customer deleted."},
        404: CustomerNotFound,
    },
)
async def delete_external(
    external_id: ExternalCustomerID,
    auth_subject: auth.CustomerWrite,
    anonymize: bool = Query(
        default=False,
        description=(
            "If true, also anonymize the customer's personal data for GDPR compliance."
        ),
    ),
    session: AsyncSession = Depends(get_db_session),
) -> None:
    """
    Delete a customer by external ID.

    Immediately cancels any active subscriptions and revokes any active benefits.

    Set `anonymize=true` to also anonymize PII for GDPR compliance.
    """
    customer = await customer_service.get_external(session, auth_subject, external_id)

    if customer is None:
        raise ResourceNotFound()

    await customer_service.delete(session, customer, anonymize=anonymize)
