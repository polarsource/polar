import json
from collections.abc import AsyncGenerator

from fastapi import Depends, Query, Response
from fastapi.responses import StreamingResponse

from polar.exceptions import ResourceNotFound
from polar.kit.csv import IterableCSVWriter
from polar.kit.metadata import MetadataQuery, get_metadata_query_openapi_schema
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.schemas import MultipleQueryFilter
from polar.member import member_service
from polar.member.schemas import Member as MemberSchema
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
    CustomerWithMembers,
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
    response_model=ListResource[CustomerWithMembers],
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
    include_members: bool = Query(
        False,
        description="Include members in the response. Only populated when set to true.",
        include_in_schema=False,
    ),
    session: AsyncReadSession = Depends(get_db_read_session),
) -> ListResource[CustomerWithMembers]:
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

    customers_with_members = []
    if include_members and results:
        customer_ids = [result.id for result in results]
        all_members = await member_service.list_by_customers(session, customer_ids)

        members_by_customer = {}
        for member in all_members:
            member_schema = MemberSchema.model_validate(member)
            if member.customer_id not in members_by_customer:
                members_by_customer[member.customer_id] = [member_schema]
            else:
                members_by_customer[member.customer_id].append(member_schema)

        for result in results:
            customer_dict = CustomerSchema.model_validate(result).model_dump()
            customer_dict["members"] = members_by_customer.get(result.id, [])
            customers_with_members.append(CustomerWithMembers(**customer_dict))
    else:
        for r in results:
            customer_dict = CustomerSchema.model_validate(r).model_dump()
            customer_dict["members"] = []
            customers_with_members.append(CustomerWithMembers(**customer_dict))

    return ListResource.from_paginated_results(
        customers_with_members,
        count,
        pagination,
    )


@router.get("/export", summary="Export Customers")
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
    response_model=CustomerWithMembers,
    responses={404: CustomerNotFound},
)
async def get(
    id: CustomerID,
    auth_subject: auth.CustomerRead,
    include_members: bool = Query(
        False,
        description="Include members in the response. Only populated when set to true.",
        include_in_schema=False,
    ),
    session: AsyncReadSession = Depends(get_db_read_session),
) -> CustomerWithMembers:
    """Get a customer by ID."""
    customer = await customer_service.get(session, auth_subject, id)

    if customer is None:
        raise ResourceNotFound()

    customer_dict = CustomerSchema.model_validate(customer).model_dump()
    if include_members:
        customer_dict["members"] = await customer_service.load_members(
            session, customer.id
        )
    else:
        customer_dict["members"] = []
    return CustomerWithMembers(**customer_dict)


@router.get(
    "/external/{external_id}",
    summary="Get Customer by External ID",
    response_model=CustomerWithMembers,
    responses={404: CustomerNotFound},
)
async def get_external(
    external_id: ExternalCustomerID,
    auth_subject: auth.CustomerRead,
    include_members: bool = Query(
        False,
        description="Include members in the response. Only populated when set to true.",
        include_in_schema=False,
    ),
    session: AsyncReadSession = Depends(get_db_read_session),
) -> CustomerWithMembers:
    """Get a customer by external ID."""
    customer = await customer_service.get_external(session, auth_subject, external_id)

    if customer is None:
        raise ResourceNotFound()

    customer_dict = CustomerSchema.model_validate(customer).model_dump()
    if include_members:
        customer_dict["members"] = await customer_service.load_members(
            session, customer.id
        )
    else:
        customer_dict["members"] = []
    return CustomerWithMembers(**customer_dict)


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
    response_model=CustomerWithMembers,
    status_code=201,
    summary="Create Customer",
    responses={201: {"description": "Customer created."}},
)
async def create(
    customer_create: CustomerCreate,
    auth_subject: auth.CustomerWrite,
    include_members: bool = Query(
        False,
        description="Include members in the response. Only populated when set to true.",
        include_in_schema=False,
    ),
    session: AsyncSession = Depends(get_db_session),
) -> CustomerWithMembers:
    """Create a customer."""
    created_customer = await customer_service.create(
        session, customer_create, auth_subject
    )

    customer = await session.get(type(created_customer), created_customer.id)
    if customer is None:
        raise ResourceNotFound()

    customer_dict = CustomerSchema.model_validate(customer).model_dump()
    if include_members:
        customer_dict["members"] = await customer_service.load_members(
            session, customer.id
        )
    else:
        customer_dict["members"] = []
    return CustomerWithMembers(**customer_dict)


@router.patch(
    "/{id}",
    response_model=CustomerWithMembers,
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
    include_members: bool = Query(
        False,
        description="Include members in the response. Only populated when set to true.",
        include_in_schema=False,
    ),
    session: AsyncSession = Depends(get_db_session),
) -> CustomerWithMembers:
    """Update a customer."""
    customer = await customer_service.get(session, auth_subject, id)

    if customer is None:
        raise ResourceNotFound()

    updated_customer = await customer_service.update(session, customer, customer_update)

    customer_dict = CustomerSchema.model_validate(updated_customer).model_dump()
    if include_members:
        customer_dict["members"] = await customer_service.load_members(
            session, updated_customer.id
        )
    else:
        customer_dict["members"] = []
    return CustomerWithMembers(**customer_dict)


@router.patch(
    "/external/{external_id}",
    response_model=CustomerWithMembers,
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
    include_members: bool = Query(
        False,
        description="Include members in the response. Only populated when set to true.",
        include_in_schema=False,
    ),
    session: AsyncSession = Depends(get_db_session),
) -> CustomerWithMembers:
    """Update a customer by external ID."""
    customer = await customer_service.get_external(session, auth_subject, external_id)

    if customer is None:
        raise ResourceNotFound()

    updated_customer = await customer_service.update(session, customer, customer_update)

    customer_dict = CustomerSchema.model_validate(updated_customer).model_dump()
    if include_members:
        customer_dict["members"] = await customer_service.load_members(
            session, updated_customer.id
        )
    else:
        customer_dict["members"] = []
    return CustomerWithMembers(**customer_dict)


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

    This action cannot be undone and will immediately:
    - Cancel any active subscriptions for the customer
    - Revoke all their benefits
    - Clear any `external_id`

    Use it only in the context of deleting a user within your
    own service. Otherwise, use more granular API endpoints to cancel
    a specific subscription or revoke certain benefits.

    Note: The customers information will nonetheless be retained for historic
    orders and subscriptions.
    """
    customer = await customer_service.get(session, auth_subject, id)

    if customer is None:
        raise ResourceNotFound()

    await customer_service.delete(session, customer)


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
    session: AsyncSession = Depends(get_db_session),
) -> None:
    """
    Delete a customer by external ID.

    Immediately cancels any active subscriptions and revokes any active benefits.
    """
    customer = await customer_service.get_external(session, auth_subject, external_id)

    if customer is None:
        raise ResourceNotFound()

    await customer_service.delete(session, customer)
