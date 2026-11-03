import json
from collections.abc import AsyncGenerator, Sequence
from typing import Annotated

from fastapi import Depends, Query
from pydantic import TypeAdapter

from polar.auth.permission import OrganizationPermission
from polar.authz.service import (
    assert_resource_permission,
    get_accessible_org_ids,
)
from polar.customer.schemas.customer import (
    CustomerExportParams,
    CustomerGrowthParams,
    CustomerListParams,
    CustomerTopParams,
)
from polar.exceptions import ResourceNotFound
from polar.kit.csv import CSVStreamingResponse, IterableCSVWriter
from polar.kit.metadata import MetadataQuery, get_metadata_query_openapi_schema
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.models import Customer, PaymentMethod
from polar.openapi import APITag, cli_preview, destructive
from polar.payment_method.schemas import PaymentMethodTypeAdapter
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
from .schemas.customer import (
    CustomerCreate,
    CustomerGrowthPeriod,
    CustomerID,
    CustomerPaymentMethod,
    CustomerPaymentMethodTypeAdapter,
    CustomerUpdate,
    CustomerUpdateExternalID,
    ExternalCustomerID,
    TopCustomer,
)
from .schemas.customer import (
    CustomerResponse as CustomerSchema,
)
from .schemas.state import CustomerState
from .service import customer as customer_service

_CustomerAdapter: TypeAdapter[CustomerSchema] = TypeAdapter(CustomerSchema)

# Bound before the `list` endpoint function below shadows the builtin
TopCustomerList = list[TopCustomer]
CustomerGrowthPeriodList = list[CustomerGrowthPeriod]

router = APIRouter(
    prefix="/customers",
    tags=["customers", APITag.public],
)


CUSTOMER_PREVIEW_FIELDS = (
    ("id", "ID"),
    ("name", "Name"),
    ("email", "Email"),
    ("external_id", "External ID"),
)

CustomerNotFound = {
    "description": "Customer not found.",
    "model": ResourceNotFound.schema(),
}


@router.get(
    "/",
    summary="List Customers",
    response_model=ListResource[CustomerSchema],
    tags=[APITag.mcp, APITag.cli],
    openapi_extra={"parameters": [get_metadata_query_openapi_schema()]},
)
async def list(
    filters: Annotated[CustomerListParams, Query()],
    auth_subject: auth.CustomerRead,
    pagination: PaginationParamsQuery,
    sorting: sorting.ListSorting,
    metadata: MetadataQuery,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> ListResource[CustomerSchema]:
    """List customers."""
    results, count = await customer_service.list(
        session,
        auth_subject,
        organization_id=filters.organization_id,
        email=filters.email,
        metadata=metadata,
        query=filters.query,
        active=filters.active,
        pagination=pagination,
        sorting=sorting,
    )

    return ListResource.from_paginated_results(
        [
            _CustomerAdapter.validate_python(result, from_attributes=True)
            for result in results
        ],
        count,
        pagination,
    )


@router.get("/export", summary="Export Customers", response_class=CSVStreamingResponse)
async def export(
    filters: Annotated[CustomerExportParams, Query()],
    auth_subject: auth.CustomerRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> CSVStreamingResponse:
    """Export customers as a CSV file."""

    async def create_csv() -> AsyncGenerator[str]:
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
        org_ids = await get_accessible_org_ids(
            session, auth_subject, permission=OrganizationPermission.customers_read
        )
        stream = repository.stream_by_organization(org_ids, filters.organization_id)

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

    return CSVStreamingResponse(create_csv(), "polar-customers.csv")


@router.get(
    "/growth",
    summary="Customer Growth",
    response_model=CustomerGrowthPeriodList,
    tags=[APITag.private],
)
async def growth(
    filters: Annotated[CustomerGrowthParams, Query()],
    auth_subject: auth.CustomerRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> Sequence[CustomerGrowthPeriod]:
    """Get new and cumulative customer counts over time."""
    periods = await customer_service.get_growth(
        session,
        auth_subject,
        organization_id=filters.organization_id,
        start=filters.start,
        end=filters.end,
        interval=filters.interval,
    )
    return [
        CustomerGrowthPeriod(
            timestamp=timestamp,
            new_customers=new_customers,
            total_customers=total_customers,
        )
        for timestamp, new_customers, total_customers in periods
    ]


@router.get(
    "/top",
    summary="Top Customers",
    response_model=TopCustomerList,
    tags=[APITag.private],
)
async def top(
    filters: Annotated[CustomerTopParams, Query()],
    auth_subject: auth.CustomerRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> TopCustomerList:
    """Rank the organization's customers by paid net revenue."""
    ranked = await customer_service.get_top_by_revenue(
        session,
        auth_subject,
        organization_id=filters.organization_id,
        start=filters.start,
        end=filters.end,
        limit=filters.limit,
    )
    return [
        TopCustomer(
            id=customer.id,
            email=customer.email,
            name=customer.name,
            avatar_url=customer.avatar_url,
            order_count=order_count,
            net_revenue=net_revenue,
        )
        for customer, order_count, net_revenue in ranked
    ]


@router.get(
    "/{id}",
    summary="Get Customer",
    openapi_extra=cli_preview(*CUSTOMER_PREVIEW_FIELDS),
    response_model=CustomerSchema,
    tags=[APITag.mcp, APITag.cli],
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
    openapi_extra=cli_preview(*CUSTOMER_PREVIEW_FIELDS),
    response_model=CustomerSchema,
    tags=[APITag.mcp, APITag.cli],
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
    tags=[APITag.mcp, APITag.cli],
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
    tags=[APITag.mcp, APITag.cli],
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


def _serialize_payment_method(
    customer: Customer, payment_method: PaymentMethod
) -> CustomerPaymentMethod:
    base = PaymentMethodTypeAdapter.validate_python(
        payment_method, from_attributes=True
    )
    return CustomerPaymentMethodTypeAdapter.validate_python(
        {
            **dict(base),
            "is_default": customer.default_payment_method_id == payment_method.id,
        }
    )


@router.get(
    "/{id}/payment-methods",
    summary="List Customer Payment Methods",
    response_model=ListResource[CustomerPaymentMethod],
    tags=[APITag.mcp, APITag.cli],
    responses={404: CustomerNotFound},
)
async def list_payment_methods(
    id: CustomerID,
    auth_subject: auth.CustomerRead,
    pagination: PaginationParamsQuery,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> ListResource[CustomerPaymentMethod]:
    """Get saved payment methods of a customer."""
    customer = await customer_service.get(session, auth_subject, id)

    if customer is None:
        raise ResourceNotFound()

    results, count = await customer_service.list_payment_methods(
        session, customer, pagination=pagination
    )

    return ListResource.from_paginated_results(
        [_serialize_payment_method(customer, result) for result in results],
        count,
        pagination,
    )


@router.get(
    "/external/{external_id}/payment-methods",
    summary="List Customer Payment Methods by External ID",
    response_model=ListResource[CustomerPaymentMethod],
    tags=[APITag.mcp, APITag.cli],
    responses={404: CustomerNotFound},
)
async def list_payment_methods_external(
    external_id: ExternalCustomerID,
    auth_subject: auth.CustomerRead,
    pagination: PaginationParamsQuery,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> ListResource[CustomerPaymentMethod]:
    """Get saved payment methods of a customer by external ID."""
    customer = await customer_service.get_external(session, auth_subject, external_id)

    if customer is None:
        raise ResourceNotFound()

    results, count = await customer_service.list_payment_methods(
        session, customer, pagination=pagination
    )

    return ListResource.from_paginated_results(
        [_serialize_payment_method(customer, result) for result in results],
        count,
        pagination,
    )


@router.post(
    "/",
    response_model=CustomerSchema,
    status_code=201,
    summary="Create Customer",
    tags=[APITag.mcp, APITag.cli],
    responses={201: {"description": "Customer created."}},
)
async def create(
    customer_create: CustomerCreate,
    auth_subject: auth.CustomerWrite,
    session: AsyncSession = Depends(get_db_session),
) -> Customer:
    """
    Create a customer.

    Set `external_id` to the customer's ID in your system to look it up by that ID.
    """
    return await customer_service.create(session, customer_create, auth_subject)


@router.patch(
    "/{id}",
    response_model=CustomerSchema,
    summary="Update Customer",
    openapi_extra=destructive(),
    tags=[APITag.mcp, APITag.cli],
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

    await assert_resource_permission(
        session, auth_subject, customer, OrganizationPermission.customers_manage
    )
    return await customer_service.update(session, customer, customer_update)


@router.patch(
    "/external/{external_id}",
    response_model=CustomerSchema,
    summary="Update Customer by External ID",
    openapi_extra=destructive(),
    tags=[APITag.mcp, APITag.cli],
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

    await assert_resource_permission(
        session, auth_subject, customer, OrganizationPermission.customers_manage
    )
    return await customer_service.update(session, customer, customer_update)


@router.delete(
    "/{id}",
    status_code=204,
    summary="Delete Customer",
    tags=[APITag.mcp, APITag.cli],
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

    await assert_resource_permission(
        session, auth_subject, customer, OrganizationPermission.customers_manage
    )
    await customer_service.delete(session, customer, anonymize=anonymize)


@router.delete(
    "/external/{external_id}",
    status_code=204,
    summary="Delete Customer by External ID",
    tags=[APITag.mcp, APITag.cli],
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

    await assert_resource_permission(
        session, auth_subject, customer, OrganizationPermission.customers_manage
    )
    await customer_service.delete(session, customer, anonymize=anonymize)
