from typing import Annotated

from fastapi import Depends, Path, Query
from pydantic import UUID4

from polar.customer.schemas.customer import CustomerID
from polar.customer_session.service import AmbiguousExternalCustomerID
from polar.event.schemas import MeterCreditEvent
from polar.exceptions import NotPermitted, ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.schemas import MultipleQueryFilter
from polar.kit.versioning import version
from polar.meter.schemas import MeterID
from polar.models import CustomerMeter, Event
from polar.openapi import APITag, destructive
from polar.organization.schemas import OrganizationID
from polar.postgres import AsyncSession, get_db_session
from polar.redis import Redis, get_redis
from polar.reducer.service import reducer as reducer_service
from polar.routing import APIRouter
from polar.version import V2027_01

from . import auth, sorting
from .schemas import CustomerMeter as CustomerMeterSchema
from .schemas import CustomerMeterCreditsCreate, CustomerMeterID
from .service import (
    CustomerMeterCreditExternalIDConflict,
    CustomerMeterCreditNotReversible,
)
from .service import customer_meter as customer_meter_service

router = APIRouter(
    prefix="/customer-meters",
    tags=["customer_meters", APITag.public, APITag.mcp, APITag.cli],
)


CustomerMeterNotFound = {
    "description": "Customer meter not found.",
    "model": ResourceNotFound.schema(),
}


@router.get(
    "/",
    summary="List Customer Meters",
    response_model=ListResource[CustomerMeterSchema],
)
async def list(
    auth_subject: auth.CustomerMeterRead,
    pagination: PaginationParamsQuery,
    sorting: sorting.ListSorting,
    organization_id: MultipleQueryFilter[OrganizationID] | None = Query(
        None, title="OrganizationID Filter", description="Filter by organization ID."
    ),
    customer_id: MultipleQueryFilter[CustomerID] | None = Query(
        None, title="CustomerID Filter", description="Filter by customer ID."
    ),
    external_customer_id: MultipleQueryFilter[str] | None = Query(
        None,
        title="ExternalCustomerID Filter",
        description="Filter by external customer ID.",
    ),
    meter_id: MultipleQueryFilter[MeterID] | None = Query(
        None, title="MeterID Filter", description="Filter by meter ID."
    ),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[CustomerMeterSchema]:
    """List customer meters."""
    results, count = await customer_meter_service.list(
        session,
        auth_subject,
        organization_id=organization_id,
        customer_id=customer_id,
        external_customer_id=external_customer_id,
        meter_id=meter_id,
        pagination=pagination,
        sorting=sorting,
    )

    return ListResource.from_paginated_results(
        [CustomerMeterSchema.model_validate(result) for result in results],
        count,
        pagination,
    )


@router.get(
    "/",
    name="list",
    summary="List Customer Meters",
    response_model=ListResource[CustomerMeterSchema],
)
@version(starting_from=V2027_01)
async def list_v2027_01(
    auth_subject: auth.CustomerMeterRead,
    pagination: PaginationParamsQuery,
    sorting: sorting.ListSorting,
    organization_id: MultipleQueryFilter[OrganizationID] | None = Query(
        None, title="OrganizationID Filter", description="Filter by organization ID."
    ),
    customer_id: MultipleQueryFilter[CustomerID] | None = Query(
        None, title="CustomerID Filter", description="Filter by customer ID."
    ),
    external_customer_id: MultipleQueryFilter[str] | None = Query(
        None,
        title="ExternalCustomerID Filter",
        description="Filter by external customer ID.",
    ),
    meter_id: MultipleQueryFilter[MeterID] | None = Query(
        None, title="MeterID Filter", description="Filter by meter ID."
    ),
    external_meter_id: MultipleQueryFilter[str] | None = Query(
        None,
        title="ExternalMeterID Filter",
        description="Filter by meter external ID.",
    ),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[CustomerMeterSchema]:
    """List customer meters."""
    results, count = await customer_meter_service.list(
        session,
        auth_subject,
        organization_id=organization_id,
        customer_id=customer_id,
        external_customer_id=external_customer_id,
        meter_id=meter_id,
        external_meter_id=external_meter_id,
        pagination=pagination,
        sorting=sorting,
    )

    return ListResource.from_paginated_results(
        [CustomerMeterSchema.model_validate(result) for result in results],
        count,
        pagination,
    )


@router.get(
    "/{id}",
    summary="Get Customer Meter",
    response_model=CustomerMeterSchema,
    responses={404: CustomerMeterNotFound},
)
async def get(
    id: CustomerMeterID,
    auth_subject: auth.CustomerMeterRead,
    session: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
) -> CustomerMeter:
    """Get a customer meter by ID."""
    customer_meter = await customer_meter_service.get(session, auth_subject, id)

    if customer_meter is None:
        raise ResourceNotFound()

    await reducer_service.log_customer_meter_comparison(session, redis, customer_meter)

    return customer_meter


@router.post(
    "/credits",
    summary="Credit Customer Meter",
    response_model=MeterCreditEvent,
    status_code=201,
    openapi_extra=destructive(),
    responses={
        201: {
            "description": (
                "Credit recorded and the customer meter balance updated. "
                "If the meter is being updated concurrently, "
                "the balance catches up shortly after."
            )
        },
        403: {
            "description": "You don't have permission to manage customers.",
            "model": NotPermitted.schema(),
        },
        409: {
            "description": (
                "The external_id is already used by a different event, "
                "or the external customer ID matches customers "
                "in several accessible organizations."
            ),
            "model": CustomerMeterCreditExternalIDConflict.schema()
            | AmbiguousExternalCustomerID.schema(),
        },
    },
)
@version(starting_from=V2027_01)
async def credits(
    credit_create: CustomerMeterCreditsCreate,
    auth_subject: auth.CustomerMeterWrite,
    session: AsyncSession = Depends(get_db_session),
) -> Event:
    """
    Manually grant credits on a customer meter.

    Returns the `meter.credited` event. The customer meter balance is updated
    before the response is returned, unless the meter is being updated
    concurrently, in which case it catches up shortly after.
    """
    return await customer_meter_service.credit(session, auth_subject, credit_create)


@router.post(
    "/credits/{id}/reverse",
    summary="Reverse Customer Meter Credit",
    response_model=MeterCreditEvent,
    status_code=201,
    openapi_extra=destructive(),
    responses={
        201: {"description": "Credit reversed."},
        403: {
            "description": "You don't have permission to manage customers.",
            "model": NotPermitted.schema(),
        },
        404: {
            "description": "Manual credit not found.",
            "model": ResourceNotFound.schema(),
        },
        409: {
            "description": (
                "The credit can't be reversed, "
                "or the customer meter is being updated: retry shortly."
            ),
            "model": CustomerMeterCreditNotReversible.schema(),
        },
    },
)
@version(starting_from=V2027_01)
async def reverse_credit(
    id: Annotated[
        UUID4,
        Path(
            description=(
                "The ID of the `meter.credited` event returned "
                "when the credit was granted."
            )
        ),
    ],
    auth_subject: auth.CustomerMeterWrite,
    session: AsyncSession = Depends(get_db_session),
) -> Event:
    """
    Reverse a manual credit, removing the units the customer hasn't used yet.

    Works once per credit, within 7 days and in the current billing period.
    Returns a `meter.credited` event with negative units and
    `parent_id` set to the reversed credit.
    """
    return await customer_meter_service.reverse_credit(session, auth_subject, id)
