from fastapi import Depends, Query

from polar.customer.schemas.customer import CustomerID
from polar.exceptions import ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.schemas import MultipleQueryFilter
from polar.meter.schemas import MeterID
from polar.models import CustomerMeter
from polar.openapi import APITag
from polar.organization.schemas import OrganizationID
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from . import auth, sorting
from .schemas import CustomerMeter as CustomerMeterSchema
from .schemas import CustomerMeterID
from .service import customer_meter as customer_meter_service

router = APIRouter(
    prefix="/customer-meters",
    tags=["customer_meters", APITag.public, APITag.mcp],
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
    "/{id}",
    summary="Get Customer Meter",
    response_model=CustomerMeterSchema,
    responses={404: CustomerMeterNotFound},
)
async def get(
    id: CustomerMeterID,
    auth_subject: auth.CustomerMeterRead,
    session: AsyncSession = Depends(get_db_session),
) -> CustomerMeter:
    """Get a customer meter by ID."""
    customer_meter = await customer_meter_service.get(session, auth_subject, id)

    if customer_meter is None:
        raise ResourceNotFound()

    return customer_meter
