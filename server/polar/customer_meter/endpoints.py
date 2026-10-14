from fastapi import Depends, Query

from polar.customer.schemas.customer import CustomerID
from polar.customer_session.service import AmbiguousExternalCustomerID
from polar.event.schemas import MeterCreditEvent
from polar.exceptions import NotPermitted, ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.schemas import MultipleQueryFilter
from polar.kit.versioning import version
from polar.meter.schemas import MeterID
from polar.models import CustomerMeter, Event
from polar.openapi import APITag, mcp_tool
from polar.organization.schemas import OrganizationID
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter
from polar.version import V2027_01

from . import auth, sorting
from .schemas import CustomerMeter as CustomerMeterSchema
from .schemas import CustomerMeterCreditsCreate, CustomerMeterID
from .service import CustomerMeterCreditExternalIDConflict
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
    openapi_extra=mcp_tool(
        description=(
            "List a customer's usage meters with their consumed units, "
            "credited units and remaining balance. Filter by `customer_id` "
            "or `external_customer_id` to see a customer's usage, or to "
            "look up their meters and current balance before granting "
            "credits. Each item includes the customer and the meter. If a "
            "meter isn't listed for the customer, find it with List meters."
        )
    ),
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
) -> CustomerMeter:
    """Get a customer meter by ID."""
    customer_meter = await customer_meter_service.get(session, auth_subject, id)

    if customer_meter is None:
        raise ResourceNotFound()

    return customer_meter


@router.post(
    "/credits",
    summary="Credit Customer Meter",
    response_model=MeterCreditEvent,
    status_code=201,
    responses={
        201: {
            "description": (
                "Credit recorded. The customer meter balance is updated asynchronously."
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
    openapi_extra=mcp_tool(
        description=(
            "Grant free units (credits) on a customer's usage meter, for "
            "example to compensate for an outage, reward an action or top "
            "up a balance. Credits can't be reversed.\n\n"
            "Before calling, get the customer's meters and current balance "
            "with List customer meters. Then show the user the customer, "
            "the meter, the units, the balance before and after, and "
            "whether unused units roll over, and get their confirmation in "
            "the conversation.\n\n"
            "Pass the customer and meter IDs from that list. Generate a new "
            "`external_id` for each credit the user confirms, and reuse it "
            "only to retry that same request: a retry with the same "
            "`external_id` and details returns the original credit instead "
            "of granting it twice.\n\n"
            "The response is the `meter.credited` event. The balance "
            "updates a few seconds later, so report the expected balance "
            "instead of reading it again straight away. A 409 on "
            "`external_id` means it belongs to a different credit and "
            "nothing was granted."
        )
    ),
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
    asynchronously, shortly after the request.
    """
    return await customer_meter_service.credit(session, auth_subject, credit_create)
